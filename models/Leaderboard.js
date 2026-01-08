import mongoose from 'mongoose';

const LeaderboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: { type: String, default: "Unknown" },
  gameId: { type: String, required: true },
  score: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

LeaderboardSchema.index({ gameId: 1, score: -1 });

// SỬA: Dùng export default thay vì module.exports
export default mongoose.model('Leaderboard', LeaderboardSchema);
