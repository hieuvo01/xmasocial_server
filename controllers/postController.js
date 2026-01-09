// File: backend/controllers/postController.js

import Post from '../models/postModel.js';
import asyncHandler from 'express-async-handler';
import Comment from '../models/commentModel.js';
import mongoose from 'mongoose';
import Notification from '../models/notificationModel.js';

// @desc    Lấy tất cả bài đăng
// @route   GET /api/posts/feed
const getPosts = asyncHandler(async (req, res) => {
  const posts = await Post.aggregate([
    { $sort: { createdAt: -1 } },
    { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'authorInfo' } },
    { $lookup: { from: 'comments', localField: '_id', foreignField: 'post', as: 'commentsData' } },
    { $addFields: { commentCount: { $size: '$commentsData' } } },
    {
      $project: {
        // 👇👇👇 CẬP NHẬT: Lấy trường 'media' thay vì 'imageUrl'
        _id: 1, content: 1, media: 1, reactions: 1, createdAt: 1, commentCount: 1,
        // Fallback: Giữ imageUrl nếu có (cho data cũ)
        imageUrl: 1, 
        author: { $arrayElemAt: ['$authorInfo', 0] },
      },
    },
    { $project: { 'author.password': 0, 'author.email': 0, 'author.createdAt': 0, 'author.updatedAt': 0 } }
  ]);

  await Post.populate(posts, {
    path: 'reactions.user',
    select: '_id displayName username avatarUrl'
  });

  res.json(posts);
});

// @desc    Get posts by a specific user
// @route   GET /api/posts/user/:userId
const getPostsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(404);
      throw new Error('User ID không hợp lệ');
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const posts = await Post.aggregate([
      { $match: { author: userObjectId } },
      { $sort: { createdAt: -1 } },
      { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'authorInfo' } },
      { $lookup: { from: 'comments', localField: '_id', foreignField: 'post', as: 'commentsData' } },
      { $addFields: { commentCount: { $size: '$commentsData' } } },
      {
        $project: {
          // 👇👇👇 CẬP NHẬT: Lấy trường 'media'
          _id: 1, content: 1, media: 1, reactions: 1, createdAt: 1, commentCount: 1,
          imageUrl: 1,
          author: { $arrayElemAt: ['$authorInfo', 0] },
        },
      },
      { $project: { 'author.password': 0, 'author.email': 0, 'author.createdAt': 0, 'author.updatedAt': 0 } }
    ]);

  await Post.populate(posts, {
    path: 'reactions.user',
    select: '_id displayName username avatarUrl'
  });

  res.json(posts);
});

// @desc    Tạo bài đăng mới (Hỗ trợ nhiều ảnh/video)
// @route   POST /api/posts
const createPost = asyncHandler(async (req, res) => {
    const { content } = req.body;

    // 👇👇👇 LOGIC MỚI: XỬ LÝ NHIỀU FILE 👇👇👇
    let mediaPaths = [];
    
    // Kiểm tra xem có file gửi lên không (req.files - số nhiều)
    if (req.files && req.files.length > 0) {
        mediaPaths = req.files.map(file => `/uploads/${file.filename}`);
    } 
    // Fallback cho code cũ (nếu lỡ upload bằng single file)
    else if (req.file) {
        mediaPaths.push(`/uploads/${req.file.filename}`);
    }
    
    // Kiểm tra validate: Phải có nội dung HOẶC có media
    if ((!content || content.trim() === '') && mediaPaths.length === 0) { 
        res.status(400); throw new Error('Nội dung hoặc hình ảnh/video không được để trống'); 
    }

    // Tạo post mới
    const post = new Post({ 
        content: content || '', 
        author: req.user._id, 
        media: mediaPaths, // Lưu mảng đường dẫn
        // Giữ imageUrl cho tương thích ngược (lấy ảnh đầu tiên hoặc rỗng)
        imageUrl: mediaPaths.length > 0 ? mediaPaths[0] : '' 
    });
    // 👆👆👆

    const createdPost = await post.save();
    
    await createdPost.populate('author', 'displayName username avatarUrl');
    
    res.status(201).json(createdPost);
});

// @desc    Thả reaction cho bài viết
// @route   POST /api/posts/:postId/react
const reactToPost = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const postId = req.params.postId;
  const userId = req.user._id;

  const allowedReactions = ['like', 'love', 'haha', 'wow', 'sad', 'angry', null, undefined];
  if (!allowedReactions.includes(type) && type !== null) {
    res.status(400); throw new Error('Loại cảm xúc không hợp lệ.');
  }

  const post = await Post.findById(postId);
  if (!post) { res.status(404); throw new Error('Không tìm thấy bài viết'); }

  const existingReactionIndex = post.reactions.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  if (existingReactionIndex >= 0) {
    if (!type) { 
      post.reactions.splice(existingReactionIndex, 1);
    } else { 
      post.reactions[existingReactionIndex].type = type;
    }
  } else if (type) {
    post.reactions.push({ user: userId, type });
    
    // ===== THÔNG BÁO LIKE POST =====
    if (post.author.toString() !== userId.toString()) {
         const existingNoti = await Notification.findOne({
             recipient: post.author,
             sender: userId,
             type: 'like_post',
             post: post._id
         });

         if (!existingNoti) {
             await Notification.create({ 
                 recipient: post.author, 
                 sender: userId, 
                 type: 'like_post', 
                 post: post._id 
             }); 
         }
    }
    // =====================================
  }

  await Post.findByIdAndUpdate(postId, { reactions: post.reactions }, { new: true });

  const updatedPost = await Post.findById(postId)
    .populate('author', 'displayName username avatarUrl')
    .populate('reactions.user', 'displayName username avatarUrl');

  res.json(updatedPost);
});

// @desc    Tạo bình luận mới (bao gồm reply)
// @route   POST /api/posts/:postId/comments
const createComment = asyncHandler(async (req, res) => {
    const { content, parentId } = req.body;
    const { postId } = req.params;

    if (!content || content.trim() === '') {
        res.status(400); throw new Error('Nội dung bình luận không được để trống');
    }

    const post = await Post.findById(postId);
    if (!post) { res.status(404); throw new Error('Không tìm thấy bài viết'); }

    // Tạo comment mới
    const newComment = new Comment({
        content,
        post: postId,
        author: req.user._id,
        parentId: parentId || null
    });
    
    await newComment.save();

    // Nếu là reply, push vào mảng replies của comment cha
    if (parentId) {
        await Comment.findByIdAndUpdate(parentId, { $push: { replies: newComment._id } });
    }

    // ===== THÔNG BÁO COMMENT =====
    try {
        const currentUserId = req.user._id.toString();

        if (parentId) {
            const parentComment = await Comment.findById(parentId).populate('author', '_id');
            if (parentComment) {
                const parentAuthorId = parentComment.author._id 
                    ? parentComment.author._id.toString() 
                    : parentComment.author.toString();

                if (parentAuthorId !== currentUserId) {
                    await Notification.create({
                        recipient: parentAuthorId,
                        sender: currentUserId,
                        type: 'reply_comment',
                        post: postId,
                        commentId: newComment._id
                    });
                }
            }
        } else {
            const postAuthorId = post.author.toString();
            if (postAuthorId !== currentUserId) {
                await Notification.create({
                    recipient: postAuthorId,
                    sender: currentUserId,
                    type: 'comment_post',
                    post: postId,
                    commentId: newComment._id
                });
            }
        }
    } catch (error) {
        console.error("Lỗi tạo thông báo comment:", error);
    }
    // ===========================================

    const populatedComment = await Comment.findById(newComment._id)
        .populate('author', 'displayName username avatarUrl');
        
    const commentObject = populatedComment.toObject();
    commentObject.parentId = newComment.parentId;
    res.status(201).json(commentObject);
});

// @desc    Lấy tất cả bình luận của một bài viết
// @route   GET /api/posts/:postId/comments
const getCommentsForPost = asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.postId);
    if (post) {
      const comments = await Comment.find({ post: req.params.postId })
        .populate('author', 'displayName avatarUrl')
        .populate('reactions.user', 'displayName avatarUrl')
        .sort({ createdAt: 'asc' });
      res.json(comments);
    } else { res.status(404); throw new Error('Không tìm thấy bài viết'); }
});

// @desc    Xóa bình luận
// @route   DELETE /api/posts/:postId/comments/:commentId
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user._id.toString();

    const comment = await Comment.findById(commentId);
    if (!comment) { res.status(404); throw new Error('Không tìm thấy bình luận'); }
    
    const post = await Post.findById(comment.post); 
    const commentAuthorId = comment.author.toString();
    const postAuthorId = post ? post.author.toString() : null;

    if (commentAuthorId === userId || postAuthorId === userId) {
      if (comment.parentId) {
          await Comment.findByIdAndUpdate(comment.parentId, { $pull: { replies: comment._id } });
      }
      await Comment.deleteMany({ parentId: commentId });
      await comment.deleteOne();
      res.status(200).json({ message: 'Bình luận đã được xóa' });
    } else { res.status(403); throw new Error('Bạn không có quyền xóa bình luận này'); }
});

// @desc    Lấy một bài viết bằng ID
// @route   GET /api/posts/:id
const getPostById = asyncHandler(async (req, res) => {
  const { id } = req.params; 

  const post = await Post.findById(id) 
    .populate('author', 'displayName username avatarUrl')
    .populate('reactions.user', 'displayName username avatarUrl');

  if (post) {
    const comments = await Comment.find({ post: id, parentId: null }) 
      .populate('author', 'displayName username avatarUrl')
      .populate('reactions.user', 'displayName username avatarUrl')
      .populate({
        path: 'replies',
        populate: {
          path: 'author reactions.user',
          select: 'displayName username avatarUrl',
        }
      })
      .sort({ createdAt: 'asc' });

    const postObject = post.toObject();
    postObject.comments = comments;
    postObject.commentCount = await Comment.countDocuments({ post: id }); 

    res.json(postObject);
  } else {
    res.status(404); throw new Error('Không tìm thấy bài viết');
  }
});


// @desc    Lấy tất cả reactions của một bài viết
// @route   GET /api/posts/:postId/reactions
const getPostReactions = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId)
    .populate({
      path: 'reactions.user',
      select: 'displayName username avatarUrl'
    });

  if (post) {
    res.json(post.reactions);
  } else {
    res.status(404); throw new Error('Post not found');
  }
});

// @desc    Xóa bài viết
// @route   DELETE /api/posts/:id
const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error('Không tìm thấy bài viết');
  }

  if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
    res.status(401);
    throw new Error('Bạn không có quyền xóa bài viết này');
  }

  await post.deleteOne(); 
  res.json({ message: 'Đã xóa bài viết thành công', id: req.params.id });
});

// @desc    [ADMIN] Lấy tất cả bài viết (Có tính count comment)
// @route   GET /api/posts/admin/all
const getAllPostsAdmin = asyncHandler(async (req, res) => {
  const posts = await Post.aggregate([
    { $sort: { createdAt: -1 } }, 
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'authorInfo'
      }
    },
    {
      $lookup: {
        from: 'comments',
        localField: '_id',
        foreignField: 'post',
        as: 'commentsData'
      }
    },
    {
      $addFields: {
        commentCount: { $size: '$commentsData' },
        author: { $arrayElemAt: ['$authorInfo', 0] } 
      }
    },
    {
      $project: {
        commentsData: 0,
        authorInfo: 0,
        'author.password': 0
      }
    }
  ]);
  
  await Post.populate(posts, {
      path: 'reactions.user',
      select: 'displayName username avatarUrl'
  });

  res.json(posts);
});

// @desc    [ADMIN] Cập nhật nội dung bài viết
// @route   PUT /api/posts/admin/:id
const updatePostAdmin = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const post = await Post.findById(req.params.id);

  if (post) {
    post.content = content || post.content;
    const updatedPost = await post.save();
    res.json(updatedPost);
  } else {
    res.status(404);
    throw new Error('Bài viết không tồn tại');
  }
});

// @desc    [ADMIN] Xóa bài viết bất kỳ
// @route   DELETE /api/posts/admin/:id
const deletePostAdmin = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (post) {
    await post.deleteOne();
    res.json({ message: 'Admin đã xóa bài viết thành công' });
  } else {
    res.status(404);
    throw new Error('Bài viết không tồn tại');
  }
});

// @desc    Tạo bài đăng mới trực tiếp với URL từ Cloudinary
// @route   POST /api/posts/create-direct
const createPostDirect = asyncHandler(async (req, res) => {
    const { content, mediaUrls } = req.body;

    // Validate: Phải có nội dung hoặc có media
    if ((!content || content.trim() === '') && (!mediaUrls || mediaUrls.length === 0)) {
        res.status(400);
        throw new Error('Nội dung hoặc hình ảnh/video không được để trống');
    }

    const post = new Post({
        content: content || '',
        author: req.user._id,
        media: mediaUrls || [], // mediaUrls là mảng string gửi từ Flutter
        imageUrl: (mediaUrls && mediaUrls.length > 0) ? mediaUrls[0] : ''
    });

    const createdPost = await post.save();
    await createdPost.populate('author', 'displayName username avatarUrl');
    res.status(201).json(createdPost);
});

export {
  getPosts,
  getPostsByUser,
  createPost,
  reactToPost,
  createComment,
  getCommentsForPost,
  deleteComment,
  getPostById,
  getPostReactions,
  deletePost,
  getAllPostsAdmin,
  updatePostAdmin,
  deletePostAdmin,
  createPostDirect
};
