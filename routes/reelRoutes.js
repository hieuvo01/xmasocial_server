// File: backend/routes/reelRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, moderator } from '../middleware/authMiddleware.js';
import { 
  getReelsFeed, 
  createReel,
  likeReel,       // <--- Import Mới
  commentOnReel,  // <--- Import Mới
  getReelComments, // <--- Import Mới
  getAllReelsAdmin,
  deleteReelAdmin
} from '../controllers/reelController.js';

const router = express.Router();

// --- CẤU HÌNH UPLOAD ---
const uploadDir = 'public/uploads/'; 
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir); 
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file video!'), false);
  }
};

const upload = multer({ storage, fileFilter });
// -----------------------------

// Route Gốc: Lấy Feed / Tạo Reel
router.route('/')
  .get(protect, getReelsFeed)
  .post(protect, upload.single('video'), createReel);

// Route MỚI: Like Reel
router.route('/:id/like').put(protect, likeReel);

// 👇 ROUTE ADMIN
router.get('/admin/all', protect, moderator, getAllReelsAdmin);
router.delete('/admin/:id', protect, moderator, deleteReelAdmin);

// Route MỚI: Comment Reel
router.route('/:id/comments')
  .get(protect, getReelComments)   // Lấy danh sách
  .post(protect, commentOnReel);   // Viết comment

export default router;
