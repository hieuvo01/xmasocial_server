import mongoose from 'mongoose';

const aiMessageSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  characterId: {
    type: String, // Ví dụ: 'ai_elon_musk', 'ai_tsundere'
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'model'], // 'user' là mình, 'model' là AI
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
}, {
  timestamps: true, // Tự động tạo createdAt
});

const AIMessage = mongoose.model('AIMessage', aiMessageSchema);
export default AIMessage;
