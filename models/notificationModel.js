// File: backend/models/notificationModel.js
import mongoose from 'mongoose';

const notificationSchema = mongoose.Schema(
  {
    // Người nhận: Nếu null hoặc target='all' thì là thông báo toàn hệ thống
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null 
    },
    
    // Người gửi (Admin hoặc User thực hiện hành động)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },

    // Loại thông báo: Thêm 'system', 'alert', 'promotion'
    type: {
      type: String,
      required: true,
      enum: ['like', 'comment', 'friend_request', 'reaction', 'like_post', 'comment_post', 'reply_comment', 'react_story', 'system', 'alert', 'promotion'], 
    },

    // Target: 'user' (cá nhân) hoặc 'all' (toàn hệ thống)
    target: { 
      type: String, 
      enum: ['user', 'all'], 
      default: 'user' 
    },

    // Nội dung thông báo hệ thống (Admin nhập)
    title: { type: String }, 
    message: { type: String },

    // Các liên kết cũ (giữ nguyên)
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    commentId: { type: String },
    story: { type: mongoose.Schema.Types.ObjectId, ref: 'Story' }, 

    isRead: { type: Boolean, required: true, default: false },
    isDeleted: { type: Boolean, default: false } // Để Admin xóa mềm
  },
  { timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
