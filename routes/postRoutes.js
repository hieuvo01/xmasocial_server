// File: backend/routes/postRoutes.js

import express from 'express';
import path from 'path';
import multer from 'multer';

const router = express.Router();

import {
   getPosts,
   createPost,
   reactToPost,
   getPostsByUser,
   getPostById,
   getPostReactions,
   deletePost,
   getAllPostsAdmin,
   deletePostAdmin,
   updatePostAdmin,
   createPostDirect
} from '../controllers/postController.js';

import * as commentController from '../controllers/commentController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// ===== CẤU HÌNH UPLOAD ẢNH & VIDEO =====
const storage = multer.diskStorage({
   destination(req, file, cb) {
      cb(null, 'public/uploads/');
   },
   filename(req, file, cb) {
      cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
   }
});

function checkFileType(file, cb) {
   const filetypes = /jpg|jpeg|png|mp4|aac|flac|mov|avi|mkv/;
   const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
   const mimetype = filetypes.test(file.mimetype);

   if (extname && mimetype) {
      return cb(null, true);
   } else {
      cb(new Error('Chỉ chấp nhận file ảnh hoặc video!'));
   }
}

const upload = multer({
   storage,
   fileFilter: function(req, file, cb) {
      checkFileType(file, cb);
   }
});

/**
 * @openapi
 * tags:
 * - name: Posts
 * description: Quản lý bài viết, tương tác, bình luận và Media
 */

// ==========================================
// 🔴 ADMIN ROUTES
// ==========================================

/**
 * @openapi
 * /api/posts/admin/all:
 * get:
 * summary: Admin lấy toàn bộ bài viết hệ thống
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: OK
 */
router.get('/admin/all', protect, admin, getAllPostsAdmin);

/**
 * @openapi
 * /api/posts/admin/{id}:
 * delete:
 * summary: Admin xóa bài viết bất kỳ
 * tags: [Posts]
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
 * description: OK
 * put:
 * summary: Admin cập nhật bài viết
 * tags: [Posts]
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
 * description: OK
 */
router.delete('/admin/:id', protect, admin, deletePostAdmin);
router.put('/admin/:id', protect, admin, updatePostAdmin);

// ==========================================
// 🔵 USER ROUTES (FEED & POSTS)
// ==========================================

/**
 * @openapi
 * /api/posts/feed:
 * get:
 * summary: Lấy bài viết cho Newsfeed (Friend posts + Public posts)
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: OK
 */
router.get('/feed', protect, getPosts);

/**
 * @openapi
 * /api/posts/user/{userId}:
 * get:
 * summary: Lấy danh sách bài viết của một user cụ thể
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: OK
 */
router.get('/user/:userId', protect, getPostsByUser);

/**
 * @openapi
 * /api/posts:
 * get:
 * summary: Lấy bài viết (General)
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: OK
 * post:
 * summary: Tạo bài viết mới (Hỗ trợ upload tối đa 10 Media files)
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * requestBody:
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * content:
 * type: string
 * media:
 * type: array
 * items:
 * type: string
 * format: binary
 * responses:
 * 201:
 * description: Đã tạo bài viết
 */
router.get('/', protect, getPosts);
router.post('/', protect, upload.array('media', 10), createPost);

/**
 * @openapi
 * /api/posts/create-direct:
 * post:
 * summary: Tạo bài viết trực tiếp (Dùng link media có sẵn)
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * responses:
 * 201:
 * description: OK
 */
router.post('/create-direct', protect, createPostDirect);

// ==========================================
// 🟡 INTERACTIONS (REACTIONS & COMMENTS)
// ==========================================

/**
 * @openapi
 * /api/posts/{postId}/react:
 * post:
 * summary: Thả cảm xúc vào bài viết
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: postId
 * required: true
 * responses:
 * 200:
 * description: OK
 */
router.post('/:postId/react', protect, reactToPost);

/**
 * @openapi
 * /api/posts/{postId}/comments:
 * get:
 * summary: Lấy danh sách bình luận của bài viết
 * tags: [Posts]
 * post:
 * summary: Viết bình luận mới
 * tags: [Posts]
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: postId
 * required: true
 * responses:
 * 201:
 * description: OK
 */
router.get('/:postId/comments', protect, commentController.getCommentsForPost);
router.post('/:postId/comments', protect, commentController.createComment);

/**
 * @openapi
 * /api/posts/{id}:
 * get:
 * summary: Chi tiết một bài viết
 * tags: [Posts]
 * delete:
 * summary: Người dùng tự xóa bài viết của mình
 * tags: [Posts]
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
router.get('/:id', protect, getPostById);
router.delete('/:id', protect, deletePost);

export default router;