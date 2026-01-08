import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    // --- CẬP NHẬT ENUM ---
    // 👇 Thêm 'sticker' và 'audio' vào danh sách này
    enum: ['text', 'image', 'video', 'revoked', 'system', 'sticker', 'audio', 'game_invite'], 
    default: 'text'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isRecalled: { 
    type: Boolean, 
    default: false 
  },
    replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
    reaction: {
    type: String, // Ví dụ: '❤️', '😆', '👍'
    default: null
  },
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);
export default Message;
