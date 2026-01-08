// File: backend/controllers/commentController.js

import asyncHandler from 'express-async-handler';
import Comment from '../models/commentModel.js';
import Post from '../models/postModel.js';
import Notification from '../models/notificationModel.js';

// @desc    Tạo bình luận mới
const createComment = asyncHandler(async (req, res) => {
    const { content, parentCommentId } = req.body;
    const { postId } = req.params;

    if (!content || content.trim() === '') {
      res.status(400); throw new Error('Nội dung bình luận không được để trống');
    }

    const post = await Post.findById(postId);
    if (!post) { res.status(404); throw new Error('Không tìm thấy bài viết'); }

    const commentData = {
      content,
      post: postId,
      author: req.user._id,
      parentComment: parentCommentId || null,
    };

    const comment = await Comment.create(commentData);

    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: comment._id }
      });
    }

    const populatedComment = await Comment.findById(comment._id).populate('author', 'displayName avatarUrl');
    res.status(201).json(populatedComment);
});

// @desc    Lấy tất cả bình luận của 1 bài viết (User xem)
const getCommentsForPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) { res.status(404); throw new Error('Không tìm thấy bài viết'); }

  const comments = await Comment.find({ post: req.params.postId, parentComment: null }) 
    .populate('author', 'displayName avatarUrl')
    .populate({
      path: 'replies',
      populate: { path: 'author', select: 'displayName avatarUrl' }
    })
    .sort({ createdAt: 'desc' });

  res.json(comments);
});

// @desc    Xóa bình luận (User tự xóa của mình)
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id.toString();
    const comment = await Comment.findById(commentId);
    if (!comment) { res.status(404); throw new Error('Không tìm thấy bình luận'); }
    const post = await Post.findById(comment.post);
    if (!post) { res.status(404); throw new Error('Không tìm thấy bài viết'); }

    if (comment.author.toString() === userId || post.author.toString() === userId) {
      if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, {
            $pull: { replies: comment._id }
        });
      }
      if (comment.replies && comment.replies.length > 0) {
        await Comment.deleteMany({ _id: { $in: comment.replies } });
      }
      await comment.deleteOne();
      res.status(200).json({ message: 'Bình luận đã được xóa' });
    } else {
      res.status(403); throw new Error('Bạn không có quyền xóa bình luận này');
    }
});

// @desc    Thả cảm xúc cho một bình luận
const reactToComment = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const comment = await Comment.findById(req.params.commentId);

  if (!comment) { res.status(404); throw new Error('Không tìm thấy bình luận.'); }

  const userId = req.user._id;
  const existingReactionIndex = comment.reactions.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  if (existingReactionIndex > -1) {
    if (comment.reactions[existingReactionIndex].type === type) {
      comment.reactions.splice(existingReactionIndex, 1);
    } else {
      comment.reactions[existingReactionIndex].type = type;
    }
  } else {
    comment.reactions.push({ type, user: userId });

    if (comment.author.toString() !== userId.toString()) {
        await Notification.create({
            recipient: comment.author,
            sender: userId,
            type: 'like_comment',
            post: comment.post,
            comment: comment._id,
        });
    }
  }

  await comment.save();

  const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'displayName avatarUrl')
      .populate({
          path: 'replies',
          populate: { path: 'author', select: 'displayName avatarUrl' }
      });

  res.status(200).json(updatedComment);
});

// ==========================================
// 👇 CÁC HÀM DÀNH CHO ADMIN / MODERATOR 👇
// ==========================================

// @desc    [ADMIN] Lấy tất cả bình luận trong hệ thống
const getAllCommentsAdmin = asyncHandler(async (req, res) => {
  const comments = await Comment.find({})
    .populate('author', 'displayName username avatarUrl') // Sửa 'user' thành 'author' cho khớp Model
    .populate('post', 'content imageUrl') 
    .sort({ createdAt: -1 });

  res.json(comments);
});

// @desc    [ADMIN] Xóa bình luận bất kỳ
const deleteCommentAdmin = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);

  if (comment) {
    // Nếu là comment cha, xóa cả comment con (tùy chọn, ở đây xóa đơn giản trước)
    if (comment.replies && comment.replies.length > 0) {
        await Comment.deleteMany({ _id: { $in: comment.replies } });
    }
    await Comment.deleteOne({ _id: comment._id });
    res.json({ message: 'Đã xóa bình luận (Admin action)' });
  } else {
    res.status(404);
    throw new Error('Không tìm thấy bình luận');
  }
});


// @desc    [ADMIN] Cập nhật nội dung bình luận
// @route   PUT /api/comments/admin/:id
const updateCommentAdmin = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const comment = await Comment.findById(req.params.id);

  if (comment) {
    comment.content = content || comment.content;
    const updatedComment = await comment.save();
    
    // Populate lại để trả về frontend hiển thị ngay nếu cần
    await updatedComment.populate('author', 'displayName username avatarUrl');
    
    res.json(updatedComment);
  } else {
    res.status(404);
    throw new Error('Không tìm thấy bình luận');
  }
});

export {
  createComment,
  getCommentsForPost,
  deleteComment,
  reactToComment,
  // 👇 Export thêm 2 hàm này
  getAllCommentsAdmin,
  deleteCommentAdmin,
  updateCommentAdmin
};
