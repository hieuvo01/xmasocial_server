// File: backend/routes/commentRoutes.js

import express from 'express';
const router = express.Router();
import {
    deleteComment,
    reactToComment,
    // 👇 Import các hàm Admin
    getAllCommentsAdmin,
    deleteCommentAdmin,
    updateCommentAdmin // 👈 THÊM IMPORT NÀY
} from '../controllers/commentController.js';
import { protect, admin, moderator } from '../middleware/authMiddleware.js';

// ==========================================
// 👇 ROUTE CHO ADMIN / MODERATOR 👇
// (Đặt trước các route có tham số :commentId)
// ==========================================

// Lấy tất cả comment
router.get('/admin/all', protect, moderator, getAllCommentsAdmin);

// Xóa comment bất kỳ
router.delete('/admin/:id', protect, moderator, deleteCommentAdmin);

// 👇 ROUTE MỚI: Sửa nội dung comment
router.put('/admin/:id', protect, moderator, updateCommentAdmin);

// ==========================================
// 👇 ROUTE CHO USER THƯỜNG 👇
// ==========================================

// Các route hành động trực tiếp trên một comment cụ thể
router.route('/:commentId').delete(protect, deleteComment);
router.route('/:commentId/react').post(protect, reactToComment);

export default router;
