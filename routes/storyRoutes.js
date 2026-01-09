// File: backend/routes/storyRoutes.js

import express from 'express';
import { 
  createStory, 
  getStoriesFeed, 
  reactToStory, 
  viewStory, 
  deleteStory, 
  getStoryViewers, 
  getStoryById,
  getAllStoriesAdmin,
  deleteStoryAdmin
} from '../controllers/storyController.js';
import { protect, moderator } from '../middleware/authMiddleware.js'; 

// 🔥 QUAN TRỌNG: Import uploadCloud từ config Cloudinary của mình
import { uploadCloud } from '../config/cloudinary.js';

const router = express.Router();

// === CẤU TRÚC ROUTE ĐÃ TỐI ƯU ===

// 1. Lấy bảng tin story
router.get('/feed', protect, getStoriesFeed);

// 2. Tạo story chữ (Không cần upload file)
router.post('/text', protect, createStory); 

// 3. Tạo story ảnh/video (Dùng uploadCloud để đẩy thẳng lên mây vĩnh viễn)
// 'media' là field name mà Flutter gửi lên trong FormData
router.post('/media', protect, uploadCloud.single('media'), createStory); 

// 4. Các route Admin/Moderator
router.get('/admin/all', protect, moderator, getAllStoriesAdmin);
router.delete('/admin/:id', protect, moderator, deleteStoryAdmin);

// 5. Tương tác với Story (React & View)
router.post('/:id/react', protect, reactToStory);
router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, getStoryViewers);

// 6. Lấy chi tiết hoặc Xóa story cá nhân
router.route('/:id')
    .get(protect, getStoryById) 
    .delete(protect, deleteStory); 

export default router;
