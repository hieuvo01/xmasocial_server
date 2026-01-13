// File: backend/routes/gameRoutes.js

import express from 'express';
import GameSave from '../models/GameSave.js'; 
import Leaderboard from '../models/Leaderboard.js';
import { protect } from '../middleware/authMiddleware.js'; 

const router = express.Router();

/**
 * @openapi
 * tags:
 * - name: Games
 * description: Quản lý lưu trữ game và bảng xếp hạng (Leaderboard)
 */

// --- 1. LƯU GAME (Save/Upsert) ---
/**
 * @openapi
 * /api/games/save-state:
 * post:
 * summary: Lưu trạng thái trò chơi (Save Game)
 * tags: [Games]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - gameId
 * - stateData
 * properties:
 * gameId:
 * type: string
 * example: "flappy_bird_01"
 * stateData:
 * type: object
 * description: Mọi dữ liệu JSON về trạng thái game
 * responses:
 * 200:
 * description: Đã lưu thành công
 */
router.post('/save-state', protect, async (req, res) => {
  try {
    const { gameId, stateData } = req.body;
    const userId = req.user._id;

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
/**
 * @openapi
 * /api/games/load-state/{gameId}:
 * get:
 * summary: Tải trạng thái đã lưu của một game
 * tags: [Games]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: gameId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Trả về stateData đã lưu
 */
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
/**
 * @openapi
 * /api/games/clear-state/{gameId}:
 * delete:
 * summary: Xóa dữ liệu save của một game
 * tags: [Games]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: gameId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Đã xóa thành công
 */
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
/**
 * @openapi
 * /api/games/submit-score:
 * post:
 * summary: Nộp điểm mới (Chỉ cập nhật nếu cao hơn điểm cũ)
 * tags: [Games]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - gameId
 * - score
 * properties:
 * gameId:
 * type: string
 * score:
 * type: number
 * responses:
 * 200:
 * description: Kết quả nộp điểm
 */
router.post('/submit-score', protect, async (req, res) => {
  try {
    const { gameId, score } = req.body;
    const userId = req.user._id;
    const username = req.user.name || req.user.username || "Gamer";

    const existingEntry = await Leaderboard.findOne({ userId, gameId });

    if (existingEntry) {
      if (score > existingEntry.score) {
        existingEntry.score = score;
        existingEntry.username = username;
        existingEntry.createdAt = Date.now();
        await existingEntry.save();
        return res.json({ success: true, message: "New high score updated!" });
      } else {
        return res.json({ success: true, message: "Score is lower than record, kept old score." });
      }
    } else {
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
/**
 * @openapi
 * /api/games/leaderboard/{gameId}:
 * get:
 * summary: Lấy Top 20 bảng xếp hạng của một trò chơi
 * tags: [Games]
 * parameters:
 * - in: path
 * name: gameId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Danh sách Top 20 điểm cao nhất
 */
router.get('/leaderboard/:gameId', async (req, res) => {
  try {
    const topScores = await Leaderboard.find({ gameId: req.params.gameId })
      .sort({ score: -1 })
      .limit(20)
      .select('username score createdAt');

    res.json(topScores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;