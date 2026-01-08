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
router.post('/submit-score', protect, async (req, res) => {
  try {
    const { gameId, score } = req.body;
    const userId = req.user._id;
    // Lấy tên user (ưu tiên name, nếu không có lấy username, hoặc email)
    const username = req.user.name || req.user.username || "Gamer"; 

    // Logic: Có thể lưu đè nếu điểm cao hơn, hoặc lưu lịch sử
    // Ở đây tui lưu lịch sử chơi mới luôn
    const newScore = new Leaderboard({ 
        userId, 
        username, 
        gameId, 
        score 
    });
    await newScore.save();
    
    res.json({ success: true, message: "Score submitted" });
  } catch (err) {
    console.error("Submit Score Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- 5. LẤY BẢNG XẾP HẠNG (Public - Không cần login cũng xem được) ---
router.get('/leaderboard/:gameId', async (req, res) => {
    try {
      const topScores = await Leaderboard.find({ gameId: req.params.gameId })
        .sort({ score: -1 }) // Điểm cao xếp trước
        .limit(10) // Lấy top 10
        .select('username score createdAt');
  
      res.json(topScores);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

export default router;
