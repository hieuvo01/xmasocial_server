// File: backend/models/aiCharacterModel.js
import mongoose from 'mongoose';

const aiCharacterSchema = mongoose.Schema({
  name: { type: String, required: true },
  avatarUrl: { type: String, required: true },
  bio: { type: String, required: true }, // Mô tả ngắn (VD: "Hỏi gì đáp nấy")
  
  // Prompt quan trọng để định hình tính cách AI (Ẩn đi khi user thường gọi API)
  systemPrompt: { 
    type: String, 
    required: true, 
    select: false // Mặc định không trả về frontend để bảo mật prompt
  }, 
  
  // Tính cách để frontend chọn icon/màu sắc
  personality: { 
    type: String, 
    required: true,
    enum: ['normal', 'gangster', 'cute', 'cold', 'funny'],
    default: 'normal'
  },

  isEnabled: { type: Boolean, default: true }, // Admin có thể tạm tắt nhân vật
}, { timestamps: true });

const AICharacter = mongoose.model('AICharacter', aiCharacterSchema);
export default AICharacter;
