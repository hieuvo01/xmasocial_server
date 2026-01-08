// File: backend/server.js

import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs'; 
import User from './models/userModel.js'; 

// --- IMPORT MODEL ---
import Message from './models/Message.js'; 
import Conversation from './models/Conversation.js';
// --------------------

// ===== FIX IMPORT SOCKET.IO =====
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Server } = require('socket.io'); 
// =================================

// Import routes
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/authRoutes.js';
import postRoutes from './routes/postRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import storyRoutes from './routes/storyRoutes.js';
import reelRoutes from './routes/reelRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import gameRoutes from './routes/gameRoutes.js';

import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();
await connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
app.set('socketio', io);

app.use(express.json());

// =========================================================================
// ===== CẤU HÌNH STATIC FILE & TẠO FOLDER TỰ ĐỘNG =====
// =========================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Định nghĩa các đường dẫn thư mục
const publicDir = path.join(__dirname, 'public');
const uploadDir = path.join(publicDir, 'uploads');
const musicDir = path.join(uploadDir, 'music'); 

// 2. Hàm tạo folder an toàn
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Đã tạo thư mục: ${dirPath}`);
    }
};

// 3. Tạo lần lượt
ensureDir(publicDir);
ensureDir(uploadDir);
ensureDir(musicDir); 

console.log("📂 Server đang phục vụ ảnh từ thư mục:", uploadDir);

// 4. Cấu hình Serve Static
app.use('/uploads', express.static(uploadDir));
// =========================================================================

app.get('/', (req, res) => {
  res.send('API Server is running successfully!');
});
// --- ROUTES ---
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/ai', aiRoutes); 
app.use('/api/games', gameRoutes);
app.get('/api', (req, res) => res.send('API Face-Noel đang chạy! 🎅'));

// =========================================================
// ===== LOGIC SOCKET.IO CHO TIN NHẮN & GAME ONLINE =====
// =========================================================
io.on("connection", (socket) => {
  console.log("🔌 User Connected:", socket.id);

  // 1. User join room cá nhân & CẬP NHẬT ONLINE
  socket.on("join", async (userId) => {
    socket.join(userId);
    socket.userId = userId; 
    console.log(`👤 User ${userId} đã join room cá nhân`);

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      socket.broadcast.emit("user_status", {
        userId: userId,
        isOnline: true,
        lastActive: null
      });
    } catch (err) {
      console.error("Lỗi update online:", err);
    }
  });

  // 2. Logic: ĐÃ XEM TIN NHẮN
  socket.on('mark_read', async ({ conversationId }) => {
    try {
      const userId = socket.userId; 
      if (!userId) return; 

      await Message.updateMany(
        { conversation: conversationId, sender: { $ne: userId }, isRead: false },
        { $set: { isRead: true } }
      );

      await Conversation.findByIdAndUpdate(conversationId, {
        [`unreadCounts.${userId}`]: 0
      });

      const conversation = await Conversation.findById(conversationId);
      if (conversation && conversation.participants) {
        conversation.participants.forEach(pId => {
          if (pId.toString() !== userId.toString()) {
             io.to(pId.toString()).emit('message_read', {
               conversationId: conversationId,
               readerId: userId
             });
          }
        });
      }
    } catch (error) {
      console.error("❌ Lỗi mark_read:", error);
    }
  });

  // ==========================================
  // 3. LOGIC GAME ONLINE (CARO / CỜ VUA / SNAKE)
  // ==========================================

  // A. Gửi lời mời chơi game
  socket.on('send_game_invite', async ({ fromUser, toUser, gameType }) => {
    try {
      console.log(`🎮 ${fromUser} mời ${toUser} chơi ${gameType}`);

      let conversation = await Conversation.findOne({
        participants: { $all: [fromUser, toUser] }
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [fromUser, toUser],
          updatedAt: new Date()
        });
      }

      const newMessage = await Message.create({
        conversation: conversation._id,
        sender: fromUser,
        content: gameType,
        type: 'game_invite',
        isRead: false
      });

      await Conversation.findByIdAndUpdate(conversation._id, {
        lastMessage: newMessage._id,
        updatedAt: new Date(),
        $inc: { [`unreadCounts.${toUser}`]: 1 }
      });

      const populatedMessage = await newMessage.populate('sender', 'displayName avatarUrl');

      io.to(toUser).emit('new_message', {
        conversationId: conversation._id,
        message: populatedMessage
      });
      
      io.to(fromUser).emit('new_message', {
        conversationId: conversation._id,
        message: populatedMessage
      });

    } catch (error) {
      console.error("Lỗi gửi invite game:", error);
    }
  });


  // B. Chấp nhận lời mời -> Tạo phòng chơi
  socket.on('accept_game_invite', ({ fromUser, toUser, gameType, inviteMessageId }) => {
    const roomId = `room_${gameType}_${Date.now()}`;
    console.log(`✅ Game bắt đầu! Room: ${roomId} giữa ${fromUser} và ${toUser}`);

    const gameData = { 
      roomId, 
      gameType, 
      hostId: fromUser, 
      guestId: toUser,  
      inviteMessageId   
    };

    io.to(fromUser).emit('game_started', gameData);
    io.to(toUser).emit('game_started', gameData);
  });

  // C. Join vào phòng Game cụ thể
  socket.on('join_game_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.userId} đã vào phòng game: ${roomId}`);
  });

  // D. Xử lý nước đi (Chung cho Caro, Chess và Snake Guest Input)
  socket.on('make_game_move', (data) => {
    // data có thể là { roomId, moveData } (Caro/Chess)
    // hoặc { roomId, dir } (Snake)

    const { roomId } = data;

    // 🔥 LOGIC SNAKE: Nếu có 'dir', đây là input của game Snake
    if (data.dir !== undefined) {
        // Gửi sự kiện riêng cho Snake để Client dễ nhận diện
        socket.to(roomId).emit('opponent_input', data);
    } else {
        // Mặc định cho Caro/Chess (gửi opponent_move)
        const moveData = data.moveData || data; 
        socket.to(roomId).emit('opponent_move', moveData);
    }
  });

  // 🔥 E. LOGIC RIÊNG CHO SNAKE ONLINE (Cập nhật Real-time)
  // Host gửi trạng thái game (vị trí rắn, táo) cho Guest
  socket.on('update_game_state', (data) => {
      // data: { roomId, snake1, snake2, food, score1, score2, dir1, dir2 }
      socket.to(data.roomId).emit('game_state_update', data);
  });

  // Tín hiệu Game Over (đồng bộ cho cả 2)
  socket.on('game_over_signal', (data) => {
      // data: { roomId, winner }
      io.in(data.roomId).emit('game_over', data);
  });


  // F. Rời phòng / Kết thúc game
  socket.on('leave_game_room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('opponent_left'); 
  });

  // G. Khi game kết thúc (thắng/thua/hòa) -> Cập nhật tin nhắn mời
  socket.on('game_finished', async ({ roomId, gameType, inviteMessageId }) => {
    try {
      console.log(`🏁 Game ${roomId} đã kết thúc. Update tin nhắn mời: ${inviteMessageId}`);
      
      let gameName = 'Game';
      if (gameType === 'caro') gameName = 'Caro';
      if (gameType === 'chess') gameName = 'Cờ Vua';
      if (gameType === 'snake') gameName = 'Rắn Săn Mồi';

      const updatedMsg = await Message.findByIdAndUpdate(
        inviteMessageId,
        { 
          type: 'text', 
          content: `🎮 Ván ${gameName} đã kết thúc.` 
        },
        { new: true }
      ).populate('sender', 'displayName avatarUrl');

      if (updatedMsg) {
        const conversationId = updatedMsg.conversation;
        
        io.to(roomId).emit('update_message', {
            conversationId: conversationId,
            message: updatedMsg
        });
        
        const conversation = await Conversation.findById(conversationId);
        if(conversation) {
            conversation.participants.forEach(userId => {
                io.to(userId.toString()).emit('message_updated', {
                    conversationId: conversationId,
                    message: updatedMsg
                });
            });
        }
      }

    } catch (error) {
      console.error("Lỗi update game finish:", error);
    }
  });

  // ==========================================

  // 4. Xử lý Disconnect & CẬP NHẬT OFFLINE
  socket.on("disconnect", async () => {
    console.log("❌ User Disconnected:", socket.id);
    
    if (socket.userId) {
      try {
        const now = new Date();
        await User.findByIdAndUpdate(socket.userId, { 
          isOnline: false,
          lastActive: now 
        });

        socket.broadcast.emit("user_status", {
          userId: socket.userId,
          isOnline: false,
          lastActive: now.toISOString()
        });
      } catch (err) {
        console.error("Lỗi update offline:", err);
      }
    }
  });
});
// =========================================================

// Middleware lỗi
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server chạy trên port ${PORT}`);
});
