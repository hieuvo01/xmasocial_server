// File: backend/routes/storyRoutes.js

import express from 'express';
import { 
  createTextStory, 
  createMediaStoryDirect, 
  getStoriesFeed, 
  reactToStory, 
  viewStory, 
  deleteStory, 
  getStoryViewers, 
  getStoryById,
  getAllStoriesAdmin,
  deleteStoryAdmin
} from '../controllers/storyController.js';
import { protect, moderator } from '../middleware/authMiddleware.js'; 

const router = express.Router();

/**
 * @openapi
 * tags:
 * - name: Stories
 * description: Hệ thống tin ngắn (biến mất sau 24h)
 */

// ==========================================
// 🔵 USER ROUTES (FEED & CREATE)
// ==========================================

/**
 * @openapi
 * /api/stories/feed:
 * get:
 * summary: Lấy danh sách story của bạn bè và bản thân
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Trả về bảng tin stories
 */
router.get('/feed', protect, getStoriesFeed);

/**
 * @openapi
 * /api/stories/text:
 * post:
 * summary: Tạo story dạng chữ (Text Story)
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * content: {type: string}
 * background: {type: string}
 * responses:
 * 201:
 * description: Đã tạo story thành công
 */
router.post('/text', protect, createTextStory); 

/**
 * @openapi
 * /api/stories/create-direct:
 * post:
 * summary: Tạo story Media (Dùng link Cloudinary trực tiếp từ Flutter)
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * mediaUrl: {type: string}
 * mediaType: {type: string, example: "image/video"}
 * responses:
 * 201:
 * description: Đã tạo story thành công
 */
router.post('/create-direct', protect, createMediaStoryDirect);

// ==========================================
// 🟡 INTERACTIONS & DETAILS
// ==========================================

/**
 * @openapi
 * /api/stories/{id}/react:
 * post:
 * summary: Thả cảm xúc vào story
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * responses:
 * 200:
 * description: OK
 */
router.post('/:id/react', protect, reactToStory);

/**
 * @openapi
 * /api/stories/{id}/view:
 * post:
 * summary: Đánh dấu đã xem story
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * responses:
 * 200:
 * description: OK
 */
router.post('/:id/view', protect, viewStory);

/**
 * @openapi
 * /api/stories/{id}/viewers:
 * get:
 * summary: Xem danh sách những người đã xem story này
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * responses:
 * 200:
 * description: Danh sách người xem
 */
router.get('/:id/viewers', protect, getStoryViewers);

/**
 * @openapi
 * /api/stories/{id}:
 * get:
 * summary: Lấy chi tiết một story
 * tags: [Stories]
 * delete:
 * summary: Xóa story cá nhân
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * responses:
 * 200:
 * description: Xóa thành công
 */
router.get('/:id', protect, getStoryById);
router.delete('/:id', protect, deleteStory);

// ==========================================
// 🔴 ADMIN ROUTES
// ==========================================

/**
 * @openapi
 * /api/stories/admin/all:
 * get:
 * summary: Admin lấy toàn bộ story hệ thống
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: OK
 */
router.get('/admin/all', protect, moderator, getAllStoriesAdmin);

/**
 * @openapi
 * /api/stories/admin/{id}:
 * delete:
 * summary: Admin xóa một story bất kỳ
 * tags: [Stories]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: id
 * required: true
 * responses:
 * 200:
 * description: OK
 */
router.delete('/admin/:id', protect, moderator, deleteStoryAdmin);

export default router;