// File: backend/routes/friendRoutes.js

import express from 'express';
import { 
    sendFriendRequest, 
    acceptFriendRequest, 
    rejectFriendRequest, 
    unfriendUser 
} from '../controllers/friendController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @openapi
 * tags:
 * - name: Friends
 * description: Quản lý kết bạn, yêu cầu kết bạn và hủy kết bạn
 */

// --- 1. GỬI LỜI MỜI KẾT BẠN ---
/**
 * @openapi
 * /api/friends/send-request/{userId}:
 * post:
 * summary: Gửi lời mời kết bạn cho người khác
 * tags: [Friends]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: string
 * description: ID của người muốn kết bạn
 * responses:
 * 200:
 * description: Đã gửi lời mời thành công
 */
router.post('/send-request/:userId', protect, sendFriendRequest);

// --- 2. CHẤP NHẬN LỜI MỜI ---
/**
 * @openapi
 * /api/friends/accept-request/{senderId}:
 * post:
 * summary: Chấp nhận lời mời kết bạn
 * tags: [Friends]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: senderId
 * required: true
 * schema:
 * type: string
 * description: ID của người đã gửi lời mời
 * responses:
 * 200:
 * description: Đã trở thành bạn bè
 */
router.post('/accept-request/:senderId', protect, acceptFriendRequest);

// --- 3. TỪ CHỐI LỜI MỜI ---
/**
 * @openapi
 * /api/friends/reject-request/{senderId}:
 * post:
 * summary: Từ chối lời mời kết bạn
 * tags: [Friends]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: senderId
 * required: true
 * schema:
 * type: string
 * description: ID của người đã gửi lời mời
 * responses:
 * 200:
 * description: Đã từ chối lời mời
 */
router.post('/reject-request/:senderId', protect, rejectFriendRequest);

// --- 4. HỦY KẾT BẠN (UNFRIEND) ---
/**
 * @openapi
 * /api/friends/unfriend/{friendId}:
 * post:
 * summary: Hủy kết bạn với một người
 * tags: [Friends]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: friendId
 * required: true
 * schema:
 * type: string
 * description: ID của người muốn hủy kết bạn
 * responses:
 * 200:
 * description: Đã hủy kết bạn thành công
 */
router.post('/unfriend/:friendId', protect, unfriendUser);

export default router;