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
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import { moderator } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// Cấu hình Multer (Upload file)
const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, 'public/uploads/'); },
  filename(req, file, cb) { cb(null, `story-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`); }
});

const checkFileType = (file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|mp4|mov|avi|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Chỉ chấp nhận file ảnh hoặc video!'));
};

const upload = multer({
  storage,
  fileFilter: function(req, file, cb) { checkFileType(file, cb); },
  limits: { fileSize: 100 * 1024 * 1024 }
});

// === QUAN TRỌNG: THỨ TỰ CÁC ROUTE ===

// 1. Các route TĨNH (không có tham số :id) - PHẢI ĐẶT TRÊN CÙNG
router.get('/feed', protect, getStoriesFeed);
router.post('/text', protect, createStory); // Tạo story chữ
router.post('/media', protect, upload.single('media'), createStory); // Tạo story ảnh/video

// 2. Các route CÓ THAM SỐ :id - PHẢI ĐẶT DƯỚI CÙNG

router.post('/:id/react', protect, reactToStory);
router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, getStoryViewers);
router.get('/admin/all', protect, moderator, getAllStoriesAdmin);
router.delete('/admin/:id', protect, moderator, deleteStoryAdmin);
// Route lấy chi tiết story (GET) và xóa story (DELETE)
router.route('/:id')
    .get(protect, getStoryById) 
    .delete(protect, deleteStory); 



export default router;
