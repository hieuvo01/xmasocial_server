// File: backend/routes/userRoutes.js

import express from 'express';
const router = express.Router();
import multer from 'multer';
import {
  authUser,
  registerUser,
  getUserById,
  getUserProfile,
  updateLastActive,
  getUserSuggestions,
  searchUsersAndPosts,
  
  // Admin/Mod Controllers
  getAllUsers,
  deleteUser,
  getDashboardStats,
  updateUserByAdmin,
  toggleBlockUser,
  loginWithGithub,
  generate2FA,
  verify2FA,
  forgotPassword, 
  resetPassword ,
  changePassword,
  updateUserProfile,
  updateUserAvatar
} from '../controllers/userController.js';

// Import middleware
import { protect, admin, moderator } from '../middleware/authMiddleware.js';
import { registerLimiter } from '../middleware/limiter.js';
import path from 'path';

// --- CẤU HÌNH MULTER CHO AVATAR ---
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'public/uploads/'); // Lưu vào thư mục public/uploads
  },
  filename(req, file, cb) {
    cb(null, `avatar-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
});
// -----------------------------------

// --- AUTH & PUBLIC ---
router.post('/login', authUser);

// Route Gốc ('/')
// - POST: Đăng ký
// - GET: Lấy tất cả user (Admin & Mod đều được xem)
router.route('/')
  .post(registerLimiter, registerUser)
  .get(protect, moderator, getAllUsers); 

// --- USER CÁ NHÂN ---
router.get('/profile', protect, getUserProfile);
router.get('/suggestions', protect, getUserSuggestions);
router.get('/search', protect, searchUsersAndPosts);
router.put('/profile', protect, updateUserProfile);
router.put('/profile/avatar', protect, upload.single('avatar'), updateUserAvatar);
router.put('/:id/last-active', protect, updateLastActive); // User tự update active status
  
// --- TWO FACTOR AUTHENTICATION ---
router.post('/2fa/generate', protect, generate2FA);
router.post('/2fa/verify', protect, verify2FA);

// --- ADMIN / MODERATOR ---
// Route này để GitHub gọi về sau khi user login xong
// GET /api/auth/github/callback
router.get('/github/callback', (req, res) => {
  const { code } = req.query;
  
  // 👇 SỬA LẠI: Redirect về Google (Trang giả để App bắt link)
  // App sẽ bắt link này trước khi Google kịp tải xong
  res.redirect(`https://www.google.com/?code=${code}`);
});

// Route Forgot Password (Public - Không cần login)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/profile/password', protect, changePassword); 
// Route POST cũ để đổi code lấy token (giữ nguyên)
router.post('/github', loginWithGithub); 

// 1. Thống kê Dashboard (Chỉ Admin)
router.get('/admin/stats', protect, admin, getDashboardStats);

// 2. Chỉnh sửa User (Chỉ Admin mới được sửa thông tin User khác)
router.put('/:id/admin-update', protect, admin, updateUserByAdmin);

// 3. Khóa/Mở khóa User (Admin và Mod đều được dùng)
router.put('/:id/block', protect, moderator, toggleBlockUser);

// 4. Xóa User & Xem chi tiết
router.route('/:id')
  .get(protect, getUserById)           // Ai cũng xem được info
  .delete(protect, admin, deleteUser); // Chỉ Admin mới được xóa vĩnh viễn

export default router;
