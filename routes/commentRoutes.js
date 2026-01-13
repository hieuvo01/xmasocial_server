// File: backend/routes/commentRoutes.js

import express from 'express';
const router = express.Router();
import {
    deleteComment,
    reactToComment,
    getAllCommentsAdmin,
    deleteCommentAdmin,
    updateCommentAdmin
} from '../controllers/commentController.js';
import { protect, admin, moderator } from '../middleware/authMiddleware.js';

/**
 * @openapi
 * tags:
 * - name: Comments
 * description: Quản lý bình luận và tương tác (Admin & User)
 */

// ==========================================
// 🔴 ROUTE CHO ADMIN / MODERATOR
// ==========================================

/**
 * @openapi
 * /api/comments/admin/all:
 * get:
 * summary: Admin lấy tất cả bình luận trên hệ thống
 * tags: [Comments]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Danh sách toàn bộ bình luận
 */
router.get('/admin/all', protect, moderator, getAllCommentsAdmin);

/**
 * @openapi
 * /api/comments/admin/{id}:
 * delete:
 * summary: Admin xóa một bình luận bất kỳ
 * tags: [Comments]
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
 * description: Đã xóa bình luận
 */
router.delete('/admin/:id', protect, moderator, deleteCommentAdmin);

/**
 * @openapi
 * /api/comments/admin/{id}:
 * put:
 * summary: Admin sửa nội dung bình luận
 * tags: [Comments]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * content:
 * type: string
 * responses:
 * 200:
 * description: Đã cập nhật bình luận
 */
router.put('/admin/:id', protect, moderator, updateCommentAdmin);

// ==========================================
// 🔵 ROUTE CHO USER THƯỜNG
// ==========================================

/**
 * @openapi
 * /api/comments/{commentId}:
 * delete:
 * summary: Người dùng tự xóa bình luận của mình
 * tags: [Comments]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: commentId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Xóa thành công
 */
router.delete('/:commentId', protect, deleteComment);

/**
 * @openapi
 * /api/comments/{commentId}/react:
 * post:
 * summary: Thả cảm xúc (Like/Love...) vào bình luận
 * tags: [Comments]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: commentId
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * emoji:
 * type: string
 * example: "❤️"
 * responses:
 * 200:
 * description: Đã cập nhật cảm xúc
 */
router.post('/:commentId/react', protect, reactToComment);

export default router;