// File: backend/routes/gameRoutes.js

import express from 'express';
import GameSave from '../models/GameSave.js'; // Nhớ thêm .js nếu dùng ES Modules
import Leaderboard from '../models/Leaderboard.js';
// Import middleware xác thực của bro (check tên file cho đúng với project của bro)
import { protect } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// --- 1. LƯU GAME (Save/Upsert) ---
router.post('/save-state', protect, async (req, res) => {
  try {
    const { gameId, stateData } = req.body;
    const userId = req.user._id; // Lấy _id từ middleware protect

    await GameSave.findOneAndUpdate(
      { userId, gameId },
      { data: stateData, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "Game saved successfully" });
  } catch (err) {
    console.error("Save Game Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 2. LOAD GAME ---
router.get('/load-state/:gameId', protect, async (req, res) => {
  try {
    const save = await GameSave.findOne({ 
      userId: req.user._id, 
      gameId: req.params.gameId 
    });
    
    if (!save) return res.json({ success: false, message: "No save found" });
    
    res.json({ success: true, stateData: save.data });
  } catch (err) {
    console.error("Load Game Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. XÓA SAVE (Clear) ---
router.delete('/clear-state/:gameId', protect, async (req, res) => {
  try {
    await GameSave.findOneAndDelete({ 
      userId: req.user._id, 
      gameId: req.params.gameId 
    });
    
    res.json({ success: true, message: "Save cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- 4. NỘP ĐIỂM (Leaderboard) ---
// Logic mới: Chỉ cập nhật nếu điểm mới CAO HƠN điểm cũ
router.post('/submit-score', protect, async (req, res) => {
  try {
    const { gameId, score } = req.body;
    const userId = req.user._id;
    // Lấy tên hiển thị ưu tiên
    const username = req.user.name || req.user.username || "Gamer";

    // 1. Tìm xem user này đã có điểm ở game này chưa
    const existingEntry = await Leaderboard.findOne({ userId, gameId });

    if (existingEntry) {
      // 2. Nếu có rồi, kiểm tra xem điểm mới có cao hơn không
      if (score > existingEntry.score) {
        existingEntry.score = score;
        existingEntry.username = username; // Cập nhật lại tên nhỡ user đổi tên
        existingEntry.createdAt = Date.now(); // Cập nhật thời gian
        await existingEntry.save();
        return res.json({ success: true, message: "New high score updated!" });
      } else {
        return res.json({ success: true, message: "Score is lower than record, kept old score." });
      }
    } else {
      // 3. Nếu chưa có thì tạo mới
      const newScore = new Leaderboard({
        userId,
        username,
        gameId,
        score
      });
      await newScore.save();
      return res.json({ success: true, message: "First score submitted!" });
    }

  } catch (err) {
    console.error("Submit Score Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 5. LẤY BẢNG XẾP HẠNG (Public) ---
router.get('/leaderboard/:gameId', async (req, res) => {
  try {
    // Lấy Top 20 người điểm cao nhất
    const topScores = await Leaderboard.find({ gameId: req.params.gameId })
      .sort({ score: -1 }) // Giảm dần
      .limit(20)
      .select('username score createdAt'); // Chỉ lấy các trường cần thiết

    res.json(topScores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
