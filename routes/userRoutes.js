// File: backend/routes/userRoutes.js
import express from 'express';
const router = express.Router();
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
  updateAvatarDirect,  
} from '../controllers/userController.js';

import { protect, admin, moderator } from '../middleware/authMiddleware.js';
import { registerLimiter } from '../middleware/limiter.js';

/**
 * @openapi
 * tags:
 * - name: Users & Auth
 * description: Quản lý tài khoản, thông tin cá nhân và quyền quản trị
 */

// ==========================================
// 🔐 AUTH & PUBLIC ROUTES
// ==========================================

/**
 * @openapi
 * /api/users/login:
 * post:
 * summary: Đăng nhập bằng email/password
 * tags: [Users & Auth]
 * responses:
 * 200:
 * description: Trả về Token và thông tin User
 */
router.post('/login', authUser);

/**
 * @openapi
 * /api/users/github:
 * post:
 * summary: Đăng nhập qua Github
 * tags: [Users & Auth]
 * responses:
 * 200:
 * description: OK
 */
router.post('/github', loginWithGithub); 

/**
 * @openapi
 * /api/users/forgot-password:
 * post:
 * summary: Yêu cầu mã reset mật khẩu qua email
 * tags: [Users & Auth]
 * responses:
 * 200:
 * description: Đã gửi email thành công
 */
router.post('/forgot-password', forgotPassword);

/**
 * @openapi
 * /api/users/reset-password:
 * post:
 * summary: Đặt lại mật khẩu mới bằng mã token
 * tags: [Users & Auth]
 * responses:
 * 200:
 * description: Đổi mật khẩu thành công
 */
router.post('/reset-password', resetPassword);

/**
 * @openapi
 * /api/users:
 * post:
 * summary: Đăng ký tài khoản mới (Có Rate Limiter)
 * tags: [Users & Auth]
 * responses:
 * 201:
 * description: Tạo user thành công
 */
router.post('/', registerLimiter, registerUser);

// ==========================================
// 👤 USER PROFILE ROUTES
// ==========================================

/**
 * @openapi
 * /api/users/profile:
 * get:
 * summary: Lấy thông tin cá nhân hiện tại
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Trả về profile user
 * put:
 * summary: Cập nhật thông tin profile
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: OK
 */
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

/**
 * @openapi
 * /api/users/profile/avatar:
 * put:
 * summary: Cập nhật ảnh đại diện (Dùng link Cloudinary trực tiếp)
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * avatarUrl: {type: string}
 * responses:
 * 200:
 * description: Đã cập nhật avatar
 */
router.put('/profile/avatar', protect, updateAvatarDirect); 

router.get('/suggestions', protect, getUserSuggestions);
router.get('/search', protect, searchUsersAndPosts);
router.put('/:id/last-active', protect, updateLastActive);
router.put('/profile/password', protect, changePassword); 

// ==========================================
// 🛡️ SECURITY (2FA)
// ==========================================

/**
 * @openapi
 * /api/users/2fa/generate:
 * post:
 * summary: Tạo mã QR để thiết lập 2FA
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Trả về mã bí mật và QR code
 */
router.post('/2fa/generate', protect, generate2FA);

/**
 * @openapi
 * /api/users/2fa/verify:
 * post:
 * summary: Xác minh và kích hoạt 2FA
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Xác minh thành công
 */
router.post('/2fa/verify', protect, verify2FA);

// ==========================================
// 🔴 ADMIN & MODERATOR
// ==========================================

/**
 * @openapi
 * /api/users/admin/stats:
 * get:
 * summary: Lấy thống kê tổng quan (Dashboard)
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Thống kê User, Posts, v.v.
 */
router.get('/admin/stats', protect, moderator, getDashboardStats);

/**
 * @openapi
 * /api/users:
 * get:
 * summary: Moderator lấy danh sách tất cả người dùng
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Danh sách user
 */
router.get('/', protect, moderator, getAllUsers);

router.put('/:id/admin-update', protect, admin, updateUserByAdmin);
router.put('/:id/block', protect, moderator, toggleBlockUser);

/**
 * @openapi
 * /api/users/{id}:
 * get:
 * summary: Lấy thông tin chi tiết một user theo ID
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: OK
 * delete:
 * summary: Admin xóa vĩnh viễn tài khoản user
 * tags: [Users & Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Đã xóa user
 */
router.get('/:id', protect, getUserById);
router.delete('/:id', protect, admin, deleteUser);

export default router;