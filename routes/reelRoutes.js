// File: backend/routes/reelRoutes.js
import express from 'express';
import { protect, moderator } from '../middleware/authMiddleware.js';
import { 
  getReelsFeed, 
  createReelDirect, 
  likeReel,       
  commentOnReel,  
  getReelComments, 
  getAllReelsAdmin,
  deleteReelAdmin
} from '../controllers/reelController.js';

const router = express.Router();

/**
 * @openapi
 * tags:
 * - name: Reels
 * description: Hệ thống video ngắn (Tương tự TikTok/Facebook Reels)
 */

// ==========================================
// 🔵 PHẦN 1: DÀNH CHO NGƯỜI DÙNG (USER)
// ==========================================

/**
 * @openapi
 * /api/reels/create-direct:
 * post:
 * summary: Tạo Reel bằng link Cloudinary trực tiếp
 * tags: [Reels]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * videoUrl: {type: string}
 * caption: {type: string}
 * responses:
 * 201:
 * description: Tạo Reel thành công
 */
router.post('/create-direct', protect, createReelDirect);

/**
 * @openapi
 * /api/reels:
 * get:
 * summary: Lấy danh sách video (Reels Feed)
 * tags: [Reels]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Trả về mảng các video ngắn
 */
router.get('/', protect, getReelsFeed);

/**
 * @openapi
 * /api/reels/{id}/like:
 * put:
 * summary: Like hoặc Unlike một video Reel
 * tags: [Reels]
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
 * description: Đã cập nhật trạng thái Like
 */
router.put('/:id/like', protect, likeReel);

/**
 * @openapi
 * /api/reels/{id}/comments:
 * get:
 * summary: Lấy danh sách bình luận của Reel
 * tags: [Reels]
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: OK
 * post:
 * summary: Thêm bình luận mới vào Reel
 * tags: [Reels]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * content: {type: string}
 * responses:
 * 201:
 * description: Đã bình luận thành công
 */
router.get('/:id/comments', protect, getReelComments);
router.post('/:id/comments', protect, commentOnReel);

// ==========================================
// 🔴 PHẦN 2: DÀNH CHO ADMIN / MODERATOR
// ==========================================

/**
 * @openapi
 * /api/reels/admin/all:
 * get:
 * summary: Admin lấy toàn bộ Reels để quản lý
 * tags: [Reels]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Danh sách tất cả video hệ thống
 */
router.get('/admin/all', protect, moderator, getAllReelsAdmin);

/**
 * @openapi
 * /api/reels/admin/{id}:
 * delete:
 * summary: Admin xóa một video Reel vi phạm
 * tags: [Reels]
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
router.delete('/admin/:id', protect, moderator, deleteReelAdmin);

export default router;