import express from 'express';
import multer from 'multer'; // <--- 1. Import Multer
import path from 'path';
import fs from 'fs'
import Conversation from '../models/Conversation.js'; 
import Message from '../models/Message.js';
import User from '../models/userModel.js'; 
import { protect } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// --- CẤU HÌNH MULTER (UPLOAD FILE) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/'); // Ảnh sẽ lưu vào thư mục 'uploads' ở root server
  },
  filename: function (req, file, cb) {
    // Đặt tên file: timestamp + tên gốc (tránh trùng)
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// Key 'image' ở đây phải khớp với key trong FormData ở Flutter
const upload = multer({ storage: storage }); 

// -------------------------------------

// --- API: TẠO HOẶC LẤY CUỘC TRÒ CHUYỆN CŨ ---
router.post('/', protect, async (req, res) => {
  const { targetId } = req.body;
  const myId = req.user._id;

  try {
    let conversation = await Conversation.findOne({
      participants: { $all: [myId, targetId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [myId, targetId],
        unreadCounts: { [myId]: 0, [targetId]: 0 }
      });
      await conversation.save();
    }
    
 // Populate thông tin người tham gia
    await conversation.populate('participants', 'displayName avatarUrl');

    
    // 1. Chuyển Mongoose Document sang Object thường JavaScript
    const result = conversation.toObject();

    // 2. Đảm bảo các trường quan trọng luôn có giá trị (tránh null/undefined)
    result.nicknames = result.nicknames || {}; 
    result.quickReaction = result.quickReaction || "👍";
    result.themeId = result.themeId || "galaxy";

    // 3. Trả về object đã xử lý
    res.status(200).json(result);
    

  } catch (err) {
    console.error("Lỗi tạo/lấy conversation:", err); // Log lỗi để dễ debug
    res.status(500).json(err);
  }
});

// --- API: LẤY DANH SÁCH INBOX ---
// --- API: LẤY DANH SÁCH INBOX (routes/messages.js) ---
router.get('/', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] }
    })
    .populate('participants', 'displayName avatarUrl')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    const result = conversations.map(c => {
      const conv = c.toObject();
      conv.unreadCount = conv.unreadCounts ? (conv.unreadCounts[req.user._id] || 0) : 0;
      conv.themeId = c.themeId || 'galaxy'; 
      
      conv.nicknames = c.nicknames || {}; 

      
      conv.quickReaction = c.quickReaction || "👍";
      return conv;
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
});


// --- API: LẤY DANH SÁCH TIN NHẮN ---
router.get('/:id/messages', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      conversation: req.params.id
    })
    .populate('sender', 'displayName avatarUrl')
    // 👇 THÊM ĐOẠN POPULATE NÀY
    .populate({
      path: 'replyTo',
      select: 'content type sender',
      populate: { path: 'sender', select: 'displayName' }
    })
    .sort({ createdAt: -1 });

    // ... (Phần logic reset unread count và xử lý tin nhắn thu hồi giữ nguyên) ...
    await Conversation.findByIdAndUpdate(req.params.id, {
      [`unreadCounts.${req.user._id}`]: 0
    });

    const processedMessages = messages.map(msg => {
      let msgObj = msg.toObject();
      if (msg.isRecalled) {
        msgObj.content = "Tin nhắn đã được thu hồi";
        msgObj.type = "revoked";
        msgObj.image = null;
      }
      return msgObj;
    });

    res.status(200).json(processedMessages);
  } catch (err) {
    console.error("Lỗi lấy tin nhắn:", err);
    res.status(500).json(err);
  }
});



// --- API: GỬI TIN NHẮN (ĐÃ TỐI ƯU CHO CLOUDINARY) ---
router.post('/:id/messages', protect, async (req, res) => {
  try {
    // Flutter bây giờ gửi content là Link HTTPS từ Cloudinary
    let { content, type, replyTo } = req.body;

    if (!content) {
        return res.status(400).json({ message: "Nội dung tin nhắn không được để trống" });
    }

    // 1. Lưu tin nhắn vào Database
    const newMessage = new Message({
      conversation: req.params.id,
      sender: req.user._id,
      content: content, // Đây là link Cloudinary
      type: type || 'text',
      replyTo: replyTo || null
    });

    let savedMessage = await newMessage.save();

    // 2. Populate thông tin để Client hiển thị
    savedMessage = await savedMessage.populate([
      { path: 'sender', select: 'displayName avatarUrl' },
      { 
        path: 'replyTo', 
        select: 'content type sender', 
        populate: { path: 'sender', select: 'displayName' } 
      }
    ]);

    // 3. Cập nhật Conversation (Last Message & Unread Count)
    const conversation = await Conversation.findById(req.params.id);
    const updates = { lastMessage: savedMessage._id };

    if (conversation.participants) {
      conversation.participants.forEach(pId => {
        // Tăng unreadCount cho người nhận
        if (pId.toString() !== req.user._id.toString()) {
            const currentCount = conversation.unreadCounts.get(pId.toString()) || 0;
            updates[`unreadCounts.${pId}`] = currentCount + 1;
        }
      });
    }
    await Conversation.findByIdAndUpdate(req.params.id, { $set: updates });

    // 4. Bắn Socket thông báo tin nhắn mới
    const io = req.app.get('socketio');
    if (conversation.participants) {
        conversation.participants.forEach(participantId => {
            io.to(participantId.toString()).emit('new_message', {
                conversationId: req.params.id,
                message: savedMessage
            });
        });
    }

    res.status(200).json(savedMessage);
  } catch (err) {
    console.error("Lỗi gửi tin nhắn:", err);
    res.status(500).json(err);
  }
});




// --- API: ĐỔI THEME CUỘC TRÒ CHUYỆN (MỚI) ---
router.put('/:id/theme', protect, async (req, res) => {
  const { themeId } = req.body;
  const conversationId = req.params.id;

  try {
    // 1. Cập nhật vào Database (để Reload không bị mất)
    const updatedConversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { themeId: themeId },
      { new: true } // Trả về dữ liệu mới sau khi update
    );

    if (!updatedConversation) {
      return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" });
    }

    // 2. BẮN SOCKET (Để bên kia tự đổi màu ngay lập tức)
    const io = req.app.get('socketio');
    
    // Logic gửi socket tới từng người trong phòng
    if (updatedConversation.participants) {
        updatedConversation.participants.forEach(participantId => {
            // Emit sự kiện 'theme_changed'
            io.to(participantId.toString()).emit('theme_changed', {
                conversationId: conversationId,
                themeId: themeId
            });
        });
    }

    res.status(200).json(updatedConversation);
  } catch (err) {
    console.error("Lỗi đổi theme:", err);
    res.status(500).json(err);
  }
});

// --- API: THU HỒI TIN NHẮN ---
router.delete('/:id/messages/:messageId', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Tin nhắn không tồn tại" });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Không có quyền" });
    }

    // 🔥 BỎ ĐOẠN XÓA FILE fs.unlinkSync Ở ĐÂY 🔥
    // Vì file đã nằm trên Cloudinary, ta chỉ cần thu hồi nội dung hiển thị

    message.isRecalled = true;
    message.content = "Tin nhắn đã được thu hồi";
    message.type = "revoked";
    await message.save();

    // Bắn Socket báo thu hồi (giữ nguyên logic cũ của bro)
    const io = req.app.get('socketio');
    const conversation = await Conversation.findById(req.params.id);
    if (conversation && conversation.participants) {
        conversation.participants.forEach(pId => {
            io.to(pId.toString()).emit('delete_message', { 
                conversationId: req.params.id,
                messageId: req.params.messageId 
            });
        });
    }

    res.status(200).json({ message: "Thu hồi thành công" });
  } catch (err) {
    res.status(500).json(err);
  }
});

// --- API: THẢ CẢM XÚC (REACTION) - MỚI THÊM ---
router.put('/:id/messages/:messageId/react', protect, async (req, res) => {
  const { reaction } = req.body; // Nhận icon cảm xúc từ Client (hoặc null nếu bỏ tim)
  const { id, messageId } = req.params; // id là conversationId

  try {
    // 1. Cập nhật trong DB
    const message = await Message.findByIdAndUpdate(
      messageId,
      { reaction: reaction },
      { new: true } // Trả về tin nhắn mới nhất
    );

    if (!message) {
      return res.status(404).json({ message: "Tin nhắn không tồn tại" });
    }

    // 2. BẮN SOCKET CHO MỌI NGƯỜI BIẾT
    const io = req.app.get('socketio');
    const conversation = await Conversation.findById(id);
    
    if (conversation && conversation.participants) {
      conversation.participants.forEach(pId => {
        io.to(pId.toString()).emit('message_reaction', {
          conversationId: id,
          messageId: messageId,
          reaction: reaction
        });
      });
    }

    res.status(200).json(message);
  } catch (err) {
    console.error("Lỗi reaction:", err);
    res.status(500).json(err);
  }
});

// --- API: ĐỔI QUICK REACTION (NÚT LIKE) ---
router.put('/:id/quick-reaction', protect, async (req, res) => {
  const { reaction } = req.body; // Emoji mới (VD: "❤️", "😆")
  
  try {
    // 1. Update vào DB
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { quickReaction: reaction },
      { new: true }
    );
    
    if (!conversation) {
        return res.status(404).json({ message: "Không tìm thấy cuộc trò chuyện" });
    }

    // 2. Bắn Socket để bên kia cập nhật ngay
    const io = req.app.get('socketio');
    if (conversation.participants) {
        conversation.participants.forEach(pId => {
            io.to(pId.toString()).emit('quick_reaction_changed', {
                conversationId: req.params.id,
                reaction: reaction
            });
        });
    }

    res.status(200).json(conversation);
  } catch (err) {
    console.error("Lỗi đổi Quick Reaction:", err);
    res.status(500).json(err);
  }
});

// --- API: ĐỔI BIỆT HIỆU (NICKNAME) ---
router.put('/:id/nickname', protect, async (req, res) => {
  const { targetUserId, nickname } = req.body;
  
  try {
    // Logic cập nhật key trong Map của Mongoose
    // Key sẽ là "nicknames.ID_USER"
    const updateQuery = {};
    updateQuery[`nicknames.${targetUserId}`] = nickname; 

    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { $set: updateQuery },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Bắn Socket thông báo
    const io = req.app.get('socketio');
    if (conversation.participants) {
      conversation.participants.forEach(pId => {
        io.to(pId.toString()).emit('nickname_changed', {
          conversationId: req.params.id,
          targetUserId: targetUserId,
          nickname: nickname
        });
      });
    }

    res.status(200).json(conversation);
  } catch (err) {
    console.error("Lỗi đổi nickname:", err);
    res.status(500).json(err);
  }
});

export default router;
