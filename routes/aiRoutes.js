// File: backend/routes/aiRoutes.js

import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AIMessage from '../models/AIMessage.js';
import AICharacter from '../models/aiCharacterModel.js'; 
import { protect, moderator } from '../middleware/authMiddleware.js'; 

const router = express.Router();

/**
 * @openapi
 * tags:
 * name: AI
 * description: Hệ thống Chatbot AI (Gemini) và quản lý nhân vật AI
 */

// ==========================================
// 🟢 PHẦN 1: QUẢN LÝ NHÂN VẬT (CHARACTERS)
// ==========================================

/**
 * @openapi
 * /api/ai/characters:
 * get:
 * summary: Lấy danh sách nhân vật AI (Cho người dùng)
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Trả về danh sách nhân vật đang hoạt động
 */
router.get('/characters', protect, async (req, res) => {
  try {
    const characters = await AICharacter.find({ isEnabled: true }).select('-systemPrompt');
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: "Lỗi lấy danh sách nhân vật" });
  }
});

/**
 * @openapi
 * /api/ai/admin/characters:
 * get:
 * summary: Admin lấy toàn bộ danh sách nhân vật
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Danh sách đầy đủ kèm System Prompt
 */
router.get('/admin/characters', protect, moderator, async (req, res) => {
  try {
    const characters = await AICharacter.find({}).select('+systemPrompt').sort({ createdAt: -1 });
    res.json(characters);
  } catch (error) {
    res.status(500).json({ error: "Lỗi Admin load nhân vật" });
  }
});

/**
 * @openapi
 * /api/ai/admin/characters:
 * post:
 * summary: Tạo nhân vật AI mới (Admin/Mod)
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * name: {type: string}
 * bio: {type: string}
 * systemPrompt: {type: string}
 * avatarUrl: {type: string}
 * personality: {type: string}
 * responses:
 * 201:
 * description: Tạo thành công
 */
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

/**
 * @openapi
 * /api/ai/admin/characters/{id}:
 * put:
 * summary: Cập nhật thông tin nhân vật AI
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * responses:
 * 200:
 * description: Cập nhật thành công
 */
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

/**
 * @openapi
 * /api/ai/admin/characters/{id}:
 * delete:
 * summary: Xóa nhân vật AI
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Xóa thành công
 */
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

/**
 * @openapi
 * /api/ai/chat:
 * post:
 * summary: Gửi tin nhắn và nhận phản hồi từ AI
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * message: {type: string}
 * character: {type: object}
 * history: {type: array, items: {type: object}}
 * responses:
 * 200:
 * description: Trả về phản hồi từ AI
 */
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, character, history } = req.body;
    const userId = req.user._id;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server chưa cấu hình GEMINI_API_KEY" });
    }

    let dbCharacter = null;
    try {
        dbCharacter = await AICharacter.findById(character.id).select('+systemPrompt');
    } catch (e) {
        console.log("Không tìm thấy character trong DB, dùng fallback client data");
    }

    const systemPromptToUse = dbCharacter ? dbCharacter.systemPrompt : (character.systemPrompt || "Bạn là trợ lý ảo hữu ích.");
    const charName = dbCharacter ? dbCharacter.name : character.name;
    const charBio = dbCharacter ? dbCharacter.bio : character.bio;

    await AIMessage.create({
      userId,
      characterId: character.id,
      role: 'user',
      content: message
    });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let chatHistory = [];
    const systemInstruction = `HÃY NHẬP VAI HOÀN TOÀN. KHÔNG BAO GIỜ THOÁT VAI. Thông tin nhân vật: Tên: ${charName}, Mô tả: ${charBio}, Kịch bản: ${systemPromptToUse}`;

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

/**
 * @openapi
 * /api/ai/history/{characterId}:
 * get:
 * summary: Lấy lịch sử chat với nhân vật
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: characterId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: OK
 */
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

/**
 * @openapi
 * /api/ai/history/{characterId}:
 * delete:
 * summary: Xóa lịch sử chat
 * tags: [AI]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: characterId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Xóa thành công
 */
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
        res.status(500).json({ error: "Lỗi Server khi xóa dữ liệu" });
    }
});

export default router;