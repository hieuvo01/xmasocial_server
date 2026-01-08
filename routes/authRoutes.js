// routes/authRoutes.js
import express from 'express';
const router = express.Router();

// Import các hàm controller
import { registerUser, loginUser } from '../controllers/authController.js';

// Định nghĩa các routes và gắn handler function tương ứng

// Route cho việc đăng ký
// Khi có request POST tới /api/auth/register, hàm registerUser sẽ được gọi
router.post('/register', registerUser);

// Route cho việc đăng nhập
// Khi có request POST tới /api/auth/login, hàm loginUser sẽ được gọi
router.post('/login', loginUser);

// Export router để server.js có thể sử dụng
export default router;
