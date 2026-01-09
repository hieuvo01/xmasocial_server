// File: backend/routes/storyRoutes.js

import express from 'express';
import { 
  createTextStory, // Import hàm tạo story chữ
  createMediaStoryDirect, // Import hàm tạo story media trực tiếp
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

// 🔥 QUAN TRỌNG: Không cần dùng uploadCloud ở đây nữa cho story media
// vì đã upload trực tiếp từ Flutter lên Cloudinary
// import { uploadCloud } from '../config/cloudinary.js'; 

const router = express.Router();

// === CẤU TRÚC ROUTE ĐÃ TỐI ƯU ===

// 1. Lấy bảng tin story
router.get('/feed', protect, getStoriesFeed);

// 2. Tạo story chữ (Flutter gọi endpoint này khi mediaType == 'text')
router.post('/text', protect, createTextStory); 

// 🔥 BỔ SUNG: Tạo story ảnh/video sau khi đã upload lên Cloudinary (Flutter gọi endpoint này)
router.post('/create-direct', protect, createMediaStoryDirect);

// 3. (Không dùng nữa cho Flutter mới) - Route cũ để tạo story ảnh/video có multer
// router.post('/media', protect, uploadCloud.single('media'), createStory); 
// Có thể xóa hoặc comment lại dòng này vì Flutter không gọi nó nữa

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