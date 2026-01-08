import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: {}
  },
  themeId: { 
    type: String, 
    default: 'galaxy' 
  },
  
  // --- THÊM DÒNG NÀY (Quick Reaction bro vừa làm) ---
  quickReaction: { 
    type: String, 
    default: "👍" 
  },

  // --- 👇 THÊM DÒNG NÀY CHO NICKNAME 👇 ---
  nicknames: { 
    type: Map,
    of: String, // Key là UserID, Value là Nickname
    default: {} 
  }
  // ----------------------------------------
  
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', ConversationSchema);

export default Conversation;
