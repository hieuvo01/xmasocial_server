// File: backend/routes/notificationRoutes.js
import express from 'express';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  sendSystemNotification,
  getAdminNotificationHistory,
  deleteAdminNotification
} from '../controllers/notificationController.js';
import { protect, moderator } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @openapi
 * tags:
 * - name: Notifications
 * description: Quản lý thông báo người dùng và thông báo hệ thống (Admin)
 */

// ==========================================
// 🔵 PHẦN 1: DÀNH CHO NGƯỜI DÙNG (USER)
// ==========================================

/**
 * @openapi
 * /api/notifications:
 * get:
 * summary: Lấy danh sách thông báo của tôi
 * tags: [Notifications]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Trả về danh sách thông báo
 */
router.get('/', protect, getNotifications);

/**
 * @openapi
 * /api/notifications/mark-all-read:
 * put:
 * summary: Đánh dấu tất cả thông báo là đã đọc
 * tags: [Notifications]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Thành công
 */
router.put('/mark-all-read', protect, markAllAsRead);

/**
 * @openapi
 * /api/notifications/{id}/mark-read:
 * put:
 * summary: Đánh dấu một thông báo cụ thể là đã đọc
 * tags: [Notifications]
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
 * description: Thành công
 */
router.put('/:id/mark-read', protect, markAsRead);

// ==========================================
// 🔴 PHẦN 2: DÀNH CHO ADMIN / MODERATOR
// ==========================================

/**
 * @openapi
 * /api/notifications/admin/send:
 * post:
 * summary: Gửi thông báo hệ thống cho toàn bộ hoặc một nhóm user
 * tags: [Notifications]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - title
 * - message
 * properties:
 * title:
 * type: string
 * message:
 * type: string
 * target:
 * type: string
 * description: "all hoặc ID người dùng cụ thể"
 * responses:
 * 201:
 * description: Đã gửi thông báo thành công
 */
router.post('/admin/send', protect, moderator, sendSystemNotification);

/**
 * @openapi
 * /api/notifications/admin/history:
 * get:
 * summary: Xem lịch sử các thông báo hệ thống đã gửi
 * tags: [Notifications]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Danh sách lịch sử thông báo
 */
router.get('/admin/history', protect, moderator, getAdminNotificationHistory);

/**
 * @openapi
 * /api/notifications/admin/{id}:
 * delete:
 * summary: Xóa một thông báo hệ thống khỏi lịch sử
 * tags: [Notifications]
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
 * description: Đã xóa thành công
 */
router.delete('/admin/:id', protect, moderator, deleteAdminNotification);

export default router;