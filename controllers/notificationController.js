// File: backend/controllers/notificationController.js
import asyncHandler from 'express-async-handler';
import Notification from '../models/notificationModel.js';

// @desc    Lấy thông báo (Bao gồm cá nhân + hệ thống)
// @route   GET /api/notifications
const getNotifications = asyncHandler(async (req, res) => {
  // Tìm thông báo gửi riêng cho User HOẶC thông báo toàn hệ thống (target: 'all')
  const notifications = await Notification.find({
    $or: [
      { recipient: req.user._id }, 
      { target: 'all' }
    ],
    // 👇 FIX: Dùng $ne (not equal) để lấy cả thông báo cũ chưa có field isDeleted
    isDeleted: { $ne: true } 
  })
    .populate('sender', 'displayName avatarUrl')
    .populate('post', 'id content')
    .populate('story', 'id mediaUrl')
    .sort({ createdAt: -1 });

  res.status(200).json(notifications);
});

// @desc    [ADMIN] Gửi thông báo hệ thống
// @route   POST /api/notifications/admin/send
const sendSystemNotification = asyncHandler(async (req, res) => {
  const { title, message, type } = req.body;

  if (!title || !message) {
    res.status(400);
    throw new Error('Thiếu tiêu đề hoặc nội dung');
  }

  const noti = await Notification.create({
    sender: req.user._id, // Admin gửi
    recipient: null,      // Không gửi cho user cụ thể nào
    target: 'all',        // Gửi cho tất cả
    type: type || 'system',
    title: title,
    message: message,
    isDeleted: false      // Tạo mới thì set luôn là false
  });

  res.status(201).json(noti);
});

// @desc    [ADMIN] Lấy toàn bộ lịch sử thông báo (Cả System & User)
// @route   GET /api/notifications/admin/history
const getAdminNotificationHistory = asyncHandler(async (req, res) => {
  // 👇 FIX: Dùng $ne: true để hiện cả thông báo cũ
  const notifications = await Notification.find({ 
      isDeleted: { $ne: true } 
    })
    .populate('sender', 'displayName avatarUrl')    // Lấy tin người gửi
    .populate('recipient', 'displayName')           // Lấy tin người nhận
    .populate('post', 'content')                    // Lấy nội dung bài viết
    .sort({ createdAt: -1 })                        
    .limit(100);                                    

  res.json(notifications);
});

// @desc    [ADMIN] Xóa thông báo (Soft Delete)
// @route   DELETE /api/notifications/admin/:id
const deleteAdminNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (notification) {
    notification.isDeleted = true; // Đánh dấu là đã xóa
    await notification.save();
    res.json({ message: 'Deleted' });
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

// Các hàm cũ (giữ nguyên logic)
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );
  res.status(200).json({ message: 'Marked all as read' });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (notification) {
    if (notification.recipient?.equals(req.user._id) || notification.target === 'all') {
       if (notification.recipient) {
           notification.isRead = true;
           await notification.save();
       }
       res.status(200).json({ message: 'Read' });
    } else {
       res.status(403).json({ message: 'Not authorized' });
    }
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

export { 
  getNotifications, 
  markAllAsRead, 
  markAsRead,
  sendSystemNotification,
  getAdminNotificationHistory,
  deleteAdminNotification
};
