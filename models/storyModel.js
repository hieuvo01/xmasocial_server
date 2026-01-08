// File: backend/models/storyModel.js

import mongoose from 'mongoose';

const reactionSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
    default: 'like',
  },
}, { _id: false });

const storySchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediaUrl: {
      type: String,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'text'],
      default: 'image',
    },
    text: {
      type: String,
    },
    style: {
      type: String, // Cho story text (gradient background)
    },
    musicUrl: {
        type: String,
    },
    musicName: {
        type: String, 
    },
    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reactions: [reactionSchema],
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // Tự động xóa sau 24h (86400 giây)
    },
  },
  {
    timestamps: true, // Tự động thêm createdAt, updatedAt
  }
);

const Story = mongoose.model('Story', storySchema);

export default Story;
