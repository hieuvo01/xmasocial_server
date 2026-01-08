import mongoose from 'mongoose';

const GameSaveSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameId: {
    type: String, 
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed, 
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

GameSaveSchema.index({ userId: 1, gameId: 1 }, { unique: true });

// SỬA: Dùng export default thay vì module.exports
export default mongoose.model('GameSave', GameSaveSchema);
