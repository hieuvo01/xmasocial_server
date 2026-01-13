// File: backend/routes/authRoutes.js
import express from 'express';
const router = express.Router();

// Import các hàm controller
import { registerUser, loginUser } from '../controllers/authController.js';

/**
 * @openapi
 * tags:
 * name: Auth
 * description: Quản lý xác thực người dùng (Đăng ký, Đăng nhập)
 */

// --- ROUTE: ĐĂNG KÝ ---
/**
 * @openapi
 * /api/auth/register:
 * post:
 * summary: Đăng ký tài khoản mới
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - name
 * - email
 * - password
 * properties:
 * name:
 * type: string
 * example: Nguyễn Văn A
 * email:
 * type: string
 * example: user@example.com
 * password:
 * type: string
 * example: 123456
 * responses:
 * 201:
 * description: Đăng ký thành công
 * 400:
 * description: Dữ liệu không hợp lệ hoặc email đã tồn tại
 */
router.post('/register', registerUser);

// --- ROUTE: ĐĂNG NHẬP ---
/**
 * @openapi
 * /api/auth/login:
 * post:
 * summary: Đăng nhập hệ thống
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - password
 * properties:
 * email:
 * type: string
 * example: user@example.com
 * password:
 * type: string
 * example: 123456
 * responses:
 * 200:
 * description: Đăng nhập thành công, trả về Token
 * 401:
 * description: Sai email hoặc mật khẩu
 */
router.post('/login', loginUser);

// Export router để server.js có thể sử dụng
export default router;