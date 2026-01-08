// Dán toàn bộ code này vào file: backend/models/commentModel.js

import mongoose from 'mongoose';
// KHÔNG cần 'mongoose-deep-populate' nữa

const reactionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
});

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Post',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    content: {
      type: String,
      required: true,
    },
    reactions: [reactionSchema],
    
    // Đổi tên `parentComment` thành `parentId` cho nhất quán
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    
    // Đây là trường THẬT chứa ID của các replies. Chúng ta sẽ populate nó.
    replies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment'
    }]
  },
  {
    timestamps: true,
    // Bỏ toJSON và toObject vì chúng ta không dùng virtual field `replies` nữa
  }
);


const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
