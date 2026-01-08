// File: backend/models/reelModel.js
import mongoose from 'mongoose';

const reelSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Nếu video từ Pexels thì không cần user
    },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    description: { type: String, default: '' },
    isExternal: { type: Boolean, default: false }, // Đánh dấu video từ Pexels
    externalId: { type: String }, // ID của Pexels
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Reel = mongoose.model('Reel', reelSchema);
export default Reel;
