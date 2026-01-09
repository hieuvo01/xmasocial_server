// File: backend/routes/userRoutes.js

import express from 'express';
const router = express.Router();
// Bro có thể giữ multer nếu vẫn muốn hỗ trợ upload file cũ, 
// nhưng với Cloudinary direct thì không cần dòng này cho route avatar nữa.
import multer from 'multer'; 
import {
  authUser,
  registerUser,
  getUserById,
  getUserProfile,
  updateLastActive,
  getUserSuggestions,
  searchUsersAndPosts,
  getAllUsers,
  deleteUser,
  getDashboardStats,
  updateUserByAdmin,
  toggleBlockUser,
  loginWithGithub,
  generate2FA,
  verify2FA,
  forgotPassword, 
  resetPassword,
  changePassword,
  updateUserProfile,
  updateAvatarDirect, // Đây là hàm nhận link Cloudinary   
} from '../controllers/userController.js';

import { protect, admin, moderator } from '../middleware/authMiddleware.js';
import { registerLimiter } from '../middleware/limiter.js';
import path from 'path';

// --- AUTH & PUBLIC ---
router.post('/login', authUser);
router.post('/github', loginWithGithub); 
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.route('/')
  .post(registerLimiter, registerUser)
  .get(protect, moderator, getAllUsers); 

// --- USER PROFILE ---
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// 🔥 SỬA Ở ĐÂY: Bỏ middleware 'upload.single' vì mình gửi JSON (link Cloudinary)
router.put('/profile/avatar', protect, updateAvatarDirect); 

router.get('/suggestions', protect, getUserSuggestions);
router.get('/search', protect, searchUsersAndPosts);
router.put('/:id/last-active', protect, updateLastActive);
router.put('/profile/password', protect, changePassword); 

// --- 2FA ---
router.post('/2fa/generate', protect, generate2FA);
router.post('/2fa/verify', protect, verify2FA);

// --- GITHUB CALLBACK ---
router.get('/github/callback', (req, res) => {
  const { code } = req.query;
  res.redirect(`https://www.google.com/?code=${code}`);
});

// --- ADMIN / MODERATOR ---
router.get('/admin/stats', protect, moderator, getDashboardStats);
router.put('/:id/admin-update', protect, admin, updateUserByAdmin);
router.put('/:id/block', protect, moderator, toggleBlockUser);

router.route('/:id')
  .get(protect, getUserById)
  .delete(protect, admin, deleteUser);

export default router;
