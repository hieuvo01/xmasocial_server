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
    updatePostAdmin
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
  // 👇👇👇 CHO PHÉP CẢ VIDEO 👇👇👇
  const filetypes = /jpg|jpeg|png|mp4|mov|avi|mkv/;
  // 👆👆👆
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

// ===== CÁC ROUTE API =====

router.get('/admin/all', protect, admin, getAllPostsAdmin);

router.route('/admin/:id')
    .delete(protect, admin, deletePostAdmin)
    .put(protect, admin, updatePostAdmin);

router.route('/feed').get(protect, getPosts);
router.route('/user/:userId').get(protect, getPostsByUser);

// 👇👇👇 SỬA ROUTE TẠO POST 👇👇👇
router.route('/')
  .get(protect, getPosts)
  // Đổi từ single('image') thành array('media', 10) để khớp với flutter
  .post(protect, upload.array('media', 10), createPost); 
// 👆👆👆

router.route('/:postId/react').post(protect, reactToPost);
router.route('/:postId/reactions').get(protect, getPostReactions);

router.route('/:postId/comments')
  .post(protect, commentController.createComment)
  .get(protect, commentController.getCommentsForPost);

router.route('/:postId/comments/:commentId')
  .delete(protect, commentController.deleteComment);

router.route('/:id') 
  .get(protect, getPostById)
  .delete(protect, deletePost); 
  
export default router;
