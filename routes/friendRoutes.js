// Dán vào file: backend/routes/friendRoutes.js

import express from 'express';
// Thêm unfriendUser vào import
import { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, unfriendUser } from '../controllers/friendController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Các route cũ
router.route('/send-request/:userId').post(protect, sendFriendRequest);
router.route('/accept-request/:senderId').post(protect, acceptFriendRequest);
router.route('/reject-request/:senderId').post(protect, rejectFriendRequest);

// ===== THÊM ROUTE MỚI ĐỂ HỦY KẾT BẠN =====
router.route('/unfriend/:friendId').post(protect, unfriendUser);
// =========================================

export default router;
