// File: backend/models/postModel.js

import mongoose from 'mongoose';

const reactionSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  type: {
    type: String,
    required: true,
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
  },
});

const postSchema = mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    content: {
      type: String,
    },
    // 👇👇👇 THAY ĐỔI Ở ĐÂY 👇👇👇
    // imageUrl: { type: String }, // <-- Code cũ
    media: [{ type: String }],     // <-- Code mới: Mảng chứa nhiều link ảnh/video
    // 👆👆👆

    reactions: [reactionSchema],
  },
  {
    timestamps: true,
  }
);

const Post = mongoose.model('Post', postSchema);
export default Post;
