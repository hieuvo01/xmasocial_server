// File: backend/routes/reelRoutes.js
import express from 'express';
import { protect, moderator } from '../middleware/authMiddleware.js';
import { 
  getReelsFeed, 
  createReelDirect, 
  likeReel,       
  commentOnReel,  
  getReelComments, 
  getAllReelsAdmin,
  deleteReelAdmin
} from '../controllers/reelController.js';

const router = express.Router();

// 🔥 ROUTE MỚI: Tạo Reel bằng link Cloudinary trực tiếp
router.route('/create-direct').post(protect, createReelDirect);

// Route Gốc: Lấy Feed
router.route('/')
  .get(protect, getReelsFeed); // ✅ Đã thêm dấu đóng hàm ở đây

// Route Like/Unlike
router.route('/:id/like').put(protect, likeReel);

// Route Comment
router.route('/:id/comments')
  .get(protect, getReelComments)   
  .post(protect, commentOnReel);   

// 👇 ROUTE ADMIN/MODERATOR
router.get('/admin/all', protect, moderator, getAllReelsAdmin);
router.delete('/admin/:id', protect, moderator, deleteReelAdmin);

export default router;
