// File: backend/server.js

import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs'; 
import User from './models/userModel.js'; 
import cors from 'cors';
// --- SỬA SWAGGER THÀNH DẠNG TĨNH ---
import swaggerUi from 'swagger-ui-express';
// --------------------

// ===== FIX IMPORT SOCKET.IO =====
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Server } = require('socket.io'); 
// =================================

// 🔥 Thêm import cloudinary
import { v2 as cloudinary } from 'cloudinary';

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

// 2. Cấu hình CORS chi tiết (Đặt trước các route)
app.use(cors({
  origin: function (origin, callback) {
    // Cho phép tất cả các origin trong giai đoạn dev, 
    // hoặc các request không có origin (như từ chính Swagger UI chạy cùng host)
    if (!origin || origin.startsWith('http://localhost') || origin.includes('onrender.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

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

// =========================================================================
// --- CẤU HÌNH SWAGGER TĨNH (ĐỌC TỪ FILE JSON) ---
// =========================================================================
const swaggerPath = path.join(__dirname, 'swagger-output.json');
let swaggerDocument = {};

if (fs.existsSync(swaggerPath)) {
    swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
} else {
    // Bản dự phòng nếu chưa có file JSON
    swaggerDocument = { openapi: "3.0.0", info: { title: "XmasOcial", version: "1.0.0" }, paths: {} };
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// =========================================================================

// 4. Cấu hình Serve Static
app.use('/uploads', express.static(uploadDir));

app.get('/', (req, res) => {
  res.send('API Server is running successfully!');
});

// 🔥 BỔ SUNG: Endpoint để Flutter lấy chữ ký Cloudinary
app.get('/api/config/cloudinary-signature', (req, res) => {
  try {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const folder = 'xmasocial_direct'; 

    const params = {
      timestamp: timestamp,
      folder: folder,
    };

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    res.json({
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      timestamp: timestamp,
      signature: signature,
      folder: folder, 
    });
  } catch (error) {
    console.error("Error generating Cloudinary signature:", error);
    res.status(500).json({ message: "Không thể lấy chữ ký Cloudinary." });
  }
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
app.get('/api', (req, res) => res.send('API XmasOcial is running...'));

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

  // 3. LOGIC GAME ONLINE
  socket.on('send_game_invite', async ({ fromUser, toUser, gameType }) => {
    try {
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

      io.to(toUser).emit('new_message', { conversationId: conversation._id, message: populatedMessage });
      io.to(fromUser).emit('new_message', { conversationId: conversation._id, message: populatedMessage });

    } catch (error) { console.error("Lỗi gửi invite game:", error); }
  });

  socket.on('accept_game_invite', ({ fromUser, toUser, gameType, inviteMessageId }) => {
    const roomId = `room_${gameType}_${Date.now()}`;
    const gameData = { roomId, gameType, hostId: fromUser, guestId: toUser, inviteMessageId };
    io.to(fromUser).emit('game_started', gameData);
    io.to(toUser).emit('game_started', gameData);
  });

  socket.on('join_game_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('make_game_move', (data) => {
    const { roomId } = data;
    if (data.dir !== undefined) {
        socket.to(roomId).emit('opponent_input', data);
    } else {
        const moveData = data.moveData || data; 
        socket.to(roomId).emit('opponent_move', moveData);
    }
  });

  socket.on('update_game_state', (data) => {
      socket.to(data.roomId).emit('game_state_update', data);
  });

  socket.on('game_over_signal', (data) => {
      io.in(data.roomId).emit('game_over', data);
  });

  socket.on('leave_game_room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('opponent_left'); 
  });

  socket.on('game_finished', async ({ roomId, gameType, inviteMessageId }) => {
    try {
      let gameName = gameType === 'caro' ? 'Caro' : gameType === 'chess' ? 'Cờ Vua' : 'Rắn Săn Mồi';

      const updatedMsg = await Message.findByIdAndUpdate(
        inviteMessageId,
        { type: 'text', content: `🎮 Ván ${gameName} đã kết thúc.` },
        { new: true }
      ).populate('sender', 'displayName avatarUrl');

      if (updatedMsg) {
        const conversationId = updatedMsg.conversation;
        io.to(roomId).emit('update_message', { conversationId, message: updatedMsg });
        const conversation = await Conversation.findById(conversationId);
        if(conversation) {
            conversation.participants.forEach(userId => {
                io.to(userId.toString()).emit('message_updated', { conversationId, message: updatedMsg });
            });
        }
      }
    } catch (error) { console.error("Lỗi update game finish:", error); }
  });

  // 4. Xử lý Disconnect
  socket.on("disconnect", async () => {
    if (socket.userId) {
      try {
        const now = new Date();
        await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastActive: now });
        socket.broadcast.emit("user_status", { userId: socket.userId, isOnline: false, lastActive: now.toISOString() });
      } catch (err) { console.error("Lỗi update offline:", err); }
    }
  });

  // 5. LOGIC CUỘC GỌI VIDEO / VOICE
  socket.on('call_invite', (data) => {
    io.to(data.to).emit('call_invite', data);
  });
  socket.on('call_accepted', (data) => {
    io.to(data.to).emit('call_accepted', data);
  });
  socket.on('call_rejected', (data) => {
    io.to(data.to).emit('call_rejected', data);
  });
  socket.on('call_cancelled', (data) => {
    io.to(data.to).emit('call_cancelled', data);
  });
  socket.on('call_ended', (data) => {
    io.to(data.to).emit('call_ended', data);
  });
});

// Middleware lỗi
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server chạy trên port ${PORT}`);
});