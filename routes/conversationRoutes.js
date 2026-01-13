import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs'
import Conversation from '../models/Conversation.js'; 
import Message from '../models/Message.js';
import User from '../models/userModel.js'; 
import { protect } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// --- CẤU HÌNH MULTER ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }); 

/**
 * @openapi
 * tags:
 * - name: Messages
 * description: Hệ thống Chat (Inbox, Tin nhắn, Cảm xúc, Themes)
 */

// ==========================================
// 🟢 PHẦN 1: QUẢN LÝ CUỘC TRÒ CHUYỆN (CONVERSATIONS)
// ==========================================

/**
 * @openapi
 * /api/messages:
 * post:
 * summary: Tạo hoặc lấy cuộc trò chuyện giữa 2 người
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * targetId:
 * type: string
 * responses:
 * 200:
 * description: Trả về thông tin cuộc trò chuyện
 */
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
    await conversation.populate('participants', 'displayName avatarUrl');
    const result = conversation.toObject();
    result.nicknames = result.nicknames || {}; 
    result.quickReaction = result.quickReaction || "👍";
    result.themeId = result.themeId || "galaxy";
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
});

/**
 * @openapi
 * /api/messages:
 * get:
 * summary: Lấy danh sách hộp thư đến (Inbox)
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Danh sách các cuộc hội thoại
 */
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

// ==========================================
// 🔵 PHẦN 2: QUẢN LÝ TIN NHẮN (MESSAGES)
// ==========================================

/**
 * @openapi
 * /api/messages/{id}/messages:
 * get:
 * summary: Lấy toàn bộ tin nhắn trong một cuộc hội thoại
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Danh sách tin nhắn
 */
router.get('/:id/messages', protect, async (req, res) => {
  try {
    const messages = await Message.find({ conversation: req.params.id })
    .populate('sender', 'displayName avatarUrl')
    .populate({
      path: 'replyTo',
      select: 'content type sender',
      populate: { path: 'sender', select: 'displayName' }
    })
    .sort({ createdAt: -1 });

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
    res.status(500).json(err);
  }
});

/**
 * @openapi
 * /api/messages/{id}/messages:
 * post:
 * summary: Gửi tin nhắn mới (Hỗ trợ Cloudinary link)
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * content: {type: string}
 * type: {type: string}
 * replyTo: {type: string}
 * responses:
 * 200:
 * description: Tin nhắn đã lưu
 */
router.post('/:id/messages', protect, async (req, res) => {
  try {
    let { content, type, replyTo } = req.body;
    if (!content) return res.status(400).json({ message: "Nội dung không được để trống" });

    const newMessage = new Message({
      conversation: req.params.id,
      sender: req.user._id,
      content: content,
      type: type || 'text',
      replyTo: replyTo || null
    });

    let savedMessage = await newMessage.save();
    savedMessage = await savedMessage.populate([
      { path: 'sender', select: 'displayName avatarUrl' },
      { path: 'replyTo', select: 'content type sender', populate: { path: 'sender', select: 'displayName' } }
    ]);

    const conversation = await Conversation.findById(req.params.id);
    const updates = { lastMessage: savedMessage._id };

    if (conversation.participants) {
      conversation.participants.forEach(pId => {
        if (pId.toString() !== req.user._id.toString()) {
            const currentCount = conversation.unreadCounts.get(pId.toString()) || 0;
            updates[`unreadCounts.${pId}`] = currentCount + 1;
        }
      });
    }
    await Conversation.findByIdAndUpdate(req.params.id, { $set: updates });

    const io = req.app.get('socketio');
    if (conversation.participants) {
        conversation.participants.forEach(participantId => {
            io.to(participantId.toString()).emit('new_message', { conversationId: req.params.id, message: savedMessage });
        });
    }
    res.status(200).json(savedMessage);
  } catch (err) {
    res.status(500).json(err);
  }
});

/**
 * @openapi
 * /api/messages/{id}/messages/{messageId}:
 * delete:
 * summary: Thu hồi tin nhắn
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * description: Conversation ID
 * - in: path
 * name: messageId
 * description: Message ID
 * responses:
 * 200:
 * description: Đã thu hồi
 */
router.delete('/:id/messages/:messageId', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: "Không tồn tại" });
    if (message.sender.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Không có quyền" });

    message.isRecalled = true;
    message.content = "Tin nhắn đã được thu hồi";
    message.type = "revoked";
    await message.save();

    const io = req.app.get('socketio');
    const conversation = await Conversation.findById(req.params.id);
    if (conversation && conversation.participants) {
        conversation.participants.forEach(pId => {
            io.to(pId.toString()).emit('delete_message', { conversationId: req.params.id, messageId: req.params.messageId });
        });
    }
    res.status(200).json({ message: "Thu hồi thành công" });
  } catch (err) {
    res.status(500).json(err);
  }
});

// ==========================================
// 🟡 PHẦN 3: TÙY CHỈNH (THEME, NICKNAME, REACTION)
// ==========================================

/**
 * @openapi
 * /api/messages/{id}/theme:
 * put:
 * summary: Đổi theme cuộc trò chuyện
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * themeId: {type: string}
 * responses:
 * 200:
 * description: OK
 */
router.put('/:id/theme', protect, async (req, res) => {
  const { themeId } = req.body;
  try {
    const updatedConversation = await Conversation.findByIdAndUpdate(req.params.id, { themeId: themeId }, { new: true });
    const io = req.app.get('socketio');
    if (updatedConversation.participants) {
        updatedConversation.participants.forEach(pId => {
            io.to(pId.toString()).emit('theme_changed', { conversationId: req.params.id, themeId: themeId });
        });
    }
    res.status(200).json(updatedConversation);
  } catch (err) {
    res.status(500).json(err);
  }
});

/**
 * @openapi
 * /api/messages/{id}/messages/{messageId}/react:
 * put:
 * summary: Thả cảm xúc vào tin nhắn
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * - in: path
 * name: messageId
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * reaction: {type: string}
 * responses:
 * 200:
 * description: OK
 */
router.put('/:id/messages/:messageId/react', protect, async (req, res) => {
  const { reaction } = req.body;
  try {
    const message = await Message.findByIdAndUpdate(req.params.messageId, { reaction: reaction }, { new: true });
    const io = req.app.get('socketio');
    const conversation = await Conversation.findById(req.params.id);
    if (conversation && conversation.participants) {
      conversation.participants.forEach(pId => {
        io.to(pId.toString()).emit('message_reaction', { conversationId: req.params.id, messageId: req.params.messageId, reaction: reaction });
      });
    }
    res.status(200).json(message);
  } catch (err) {
    res.status(500).json(err);
  }
});

/**
 * @openapi
 * /api/messages/{id}/quick-reaction:
 * put:
 * summary: Đổi nút Quick Reaction (Nút Like)
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * reaction: {type: string}
 * responses:
 * 200:
 * description: OK
 */
router.put('/:id/quick-reaction', protect, async (req, res) => {
  const { reaction } = req.body;
  try {
    const conversation = await Conversation.findByIdAndUpdate(req.params.id, { quickReaction: reaction }, { new: true });
    const io = req.app.get('socketio');
    if (conversation.participants) {
        conversation.participants.forEach(pId => {
            io.to(pId.toString()).emit('quick_reaction_changed', { conversationId: req.params.id, reaction: reaction });
        });
    }
    res.status(200).json(conversation);
  } catch (err) {
    res.status(500).json(err);
  }
});

/**
 * @openapi
 * /api/messages/{id}/nickname:
 * put:
 * summary: Đổi biệt hiệu của thành viên trong cuộc trò chuyện
 * tags: [Messages]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * targetUserId: {type: string}
 * nickname: {type: string}
 * responses:
 * 200:
 * description: OK
 */
router.put('/:id/nickname', protect, async (req, res) => {
  const { targetUserId, nickname } = req.body;
  try {
    const updateQuery = {};
    updateQuery[`nicknames.${targetUserId}`] = nickname; 
    const conversation = await Conversation.findByIdAndUpdate(req.params.id, { $set: updateQuery }, { new: true });
    const io = req.app.get('socketio');
    if (conversation.participants) {
      conversation.participants.forEach(pId => {
        io.to(pId.toString()).emit('nickname_changed', { conversationId: req.params.id, targetUserId: targetUserId, nickname: nickname });
      });
    }
    res.status(200).json(conversation);
  } catch (err) {
    res.status(500).json(err);
  }
});

export default router;