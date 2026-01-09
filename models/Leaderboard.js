// File: backend/models/Leaderboard.js

import mongoose from 'mongoose';

const LeaderboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: { 
    type: String, 
    default: "Unknown" 
  },
  gameId: { 
    type: String, 
    required: true, 
    enum: ['snake', 'brick_breaker', '2048'] // Chỉ cho phép 3 game này để tránh lỗi typo
  },
  score: { 
    type: Number, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Đánh index để tìm kiếm nhanh:
// Tìm theo gameId và sắp xếp điểm từ cao xuống thấp
LeaderboardSchema.index({ gameId: 1, score: -1 });

export default mongoose.model('Leaderboard', LeaderboardSchema);
