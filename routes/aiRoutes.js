// File: backend/routes/aiRoutes.js

import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AIMessage from '../models/AIMessage.js';
import AICharacter from '../models/aiCharacterModel.js'; // 👈 QUAN TRỌNG: Import Model nhân vật
import { protect, moderator } from '../middleware/authMiddleware.js'; // 👈 QUAN TRỌNG: Import moderator

const router = express.Router();

// ==========================================
// 🟢 PHẦN 1: QUẢN LÝ NHÂN VẬT (CHARACTERS)
// ==========================================

// 1. Lấy danh sách nhân vật (Cho App User hiển thị)
router.get('/characters', protect, async (req, res) => {
  try {
    // Chỉ lấy nhân vật đang bật, ẩn systemPrompt để bảo mật
    const characters = await AICharacter.find({ isEnabled: true }).select('-systemPrompt');
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách nhân vật" });
  }
});

// 2. [ADMIN] Lấy tất cả nhân vật (Kèm System Prompt để sửa)
router.get('/admin/characters', protect, moderator, async (req, res) => {
  try {
    const characters = await AICharacter.find({}).select('+systemPrompt').sort({ createdAt: -1 });
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: "Lỗi Admin load nhân vật" });
  }
});

// 3. [ADMIN] Tạo nhân vật mới
router.post('/admin/characters', protect, moderator, async (req, res) => {
  try {
    const { name, avatarUrl, bio, systemPrompt, personality } = req.body;
    const character = await AICharacter.create({
      name, 
      avatarUrl: avatarUrl || 'https://cdn-icons-png.flaticon.com/512/4712/4712027.png', 
      bio, 
      systemPrompt, 
      personality: personality || 'normal'
    });
    res.status(201).json(character);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. [ADMIN] Sửa nhân vật
router.put('/admin/characters/:id', protect, moderator, async (req, res) => {
  try {
    const character = await AICharacter.findById(req.params.id);
    if (character) {
      character.name = req.body.name || character.name;
      character.avatarUrl = req.body.avatarUrl || character.avatarUrl;
      character.bio = req.body.bio || character.bio;
      character.personality = req.body.personality || character.personality;
      if (req.body.systemPrompt) character.systemPrompt = req.body.systemPrompt;
      if (req.body.isEnabled !== undefined) character.isEnabled = req.body.isEnabled;

      const updated = await character.save();
      res.json(updated);
    } else {
      res.status(404).json({ error: "Không tìm thấy nhân vật" });
    }
  } catch (error) {
    res.status(500).json({ error: "Lỗi cập nhật" });
  }
});

// 5. [ADMIN] Xóa nhân vật
router.delete('/admin/characters/:id', protect, moderator, async (req, res) => {
  try {
    await AICharacter.deleteOne({ _id: req.params.id });
    res.json({ message: "Đã xóa nhân vật" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi xóa nhân vật" });
  }
});

// ==========================================
// 🔵 PHẦN 2: CHAT AI (LOGIC THÔNG MINH)
// ==========================================

// 1. API Gửi tin nhắn & Lưu vào DB
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, character, history } = req.body;
    const userId = req.user._id;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server chưa cấu hình GEMINI_API_KEY" });
    }

    // 👇 BƯỚC QUAN TRỌNG: Tìm Character trong DB để lấy System Prompt MỚI NHẤT
    // (Thay vì tin tưởng data client gửi lên)
    let dbCharacter = null;
    try {
        dbCharacter = await AICharacter.findById(character.id).select('+systemPrompt');
    } catch (e) {
        console.log("Không tìm thấy character trong DB, dùng fallback client data");
    }

    // Ưu tiên dùng data từ DB, nếu không có thì dùng data client (fallback)
    const systemPromptToUse = dbCharacter ? dbCharacter.systemPrompt : (character.systemPrompt || "Bạn là trợ lý ảo hữu ích.");
    const charName = dbCharacter ? dbCharacter.name : character.name;
    const charBio = dbCharacter ? dbCharacter.bio : character.bio;


    // --- A. LƯU TIN NHẮN CỦA USER VÀO DB NGAY ---
    await AIMessage.create({
      userId,
      characterId: character.id,
      role: 'user',
      content: message
    });

    // --- B. GỌI GEMINI ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let chatHistory = [];
    
    // 👇 Prompt Xịn (Đã cập nhật biến động)
    const systemInstruction = `
        HÃY NHẬP VAI HOÀN TOÀN. KHÔNG BAO GIỜ THOÁT VAI.
        
        Thông tin nhân vật của bạn:
        - Tên: ${charName}
        - Mô tả: ${charBio}
        - Kịch bản nhập vai (SYSTEM PROMPT): "${systemPromptToUse}"
        
        Quy tắc bắt buộc:
        1. Trả lời đúng với tính cách, giọng điệu được mô tả ở trên.
        2. Không bao giờ nói "Tôi là AI", "Tôi là Gemini" hay "Tôi là máy tính".
        3. Nếu User hỏi bạn là ai, hãy trả lời theo tên nhân vật của bạn.
        4. Giữ câu trả lời ngắn gọn, tự nhiên như chat mạng xã hội (trừ khi được yêu cầu viết dài).
    `;

    chatHistory.push({ role: "user", parts: [{ text: systemInstruction }] });
    chatHistory.push({ role: "model", parts: [{ text: `Đã rõ. Tôi là ${charName}.` }] });

    if (history && Array.isArray(history)) {
      history.forEach(msg => {
         const role = (msg.role === 'ai' || msg.role === 'model') ? 'model' : 'user';
         if (msg.content) chatHistory.push({ role: role, parts: [{ text: msg.content }] });
      });
    }

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    // --- C. LƯU CÂU TRẢ LỜI CỦA AI VÀO DB ---
    await AIMessage.create({
      userId,
      characterId: character.id,
      role: 'model',
      content: text
    });

    res.json({ reply: text });

  } catch (error) {
    console.error("❌ AI Error:", error);
    res.status(500).json({ reply: "Xin lỗi, tôi bị mất kết nối server." });
  }
});

// 2. API Lấy lịch sử chat cũ
router.get('/history/:characterId', protect, async (req, res) => {
    try {
        const messages = await AIMessage.find({
            userId: req.user._id,
            characterId: req.params.characterId
        }).sort({ createdAt: 1 });

        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'model' ? 'ai' : 'user',
            content: msg.content
        }));

        res.json(formattedMessages);
    } catch (error) {
        res.status(500).json({ error: "Lỗi lấy lịch sử" });
    }
});

// 3. Xóa lịch sử
router.delete('/history/:characterId', protect, async (req, res) => {
    try {
        const { characterId } = req.params;
        const userId = req.user._id;

        await AIMessage.deleteMany({ 
            userId: userId, 
            characterId: characterId 
        });

        res.status(200).json({ message: "Đã xóa lịch sử chat thành công" });
    } catch (error) {
        console.error("❌ Lỗi xóa history:", error);
        res.status(500).json({ error: "Lỗi Server khi xóa dữ liệu" });
    }
});

export default router;
