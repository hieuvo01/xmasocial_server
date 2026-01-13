// File: backend/routes/notificationRoutes.js
import express from 'express';
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  sendSystemNotification,      // Mới
  getAdminNotificationHistory, // Mới
  deleteAdminNotification      // Mới
} from '../controllers/notificationController.js';
import { protect, moderator } from '../middleware/authMiddleware.js';

const router = express.Router();

// User Routes
router.route('/').get(protect, getNotifications);
router.route('/mark-all-read').put(protect, markAllAsRead); // Sửa lại route cho chuẩn REST (dùng PUT)
router.route('/:id/mark-read').put(protect, markAsRead);

// Admin Routes (Yêu cầu quyền moderator)
router.post('/admin/send', protect, moderator, sendSystemNotification);
router.get('/admin/history', protect, moderator, getAdminNotificationHistory);
router.delete('/admin/:id', protect, moderator, deleteAdminNotification);

export default router;
