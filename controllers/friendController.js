// Dán vào file: backend/controllers/friendController.js

import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Notification from '../models/notificationModel.js';

// @desc    Gửi lời mời kết bạn
// @route   POST /api/friends/send-request/:userId
// @access  Private
const sendFriendRequest = asyncHandler(async (req, res) => {
  const sender = await User.findById(req.user._id);
  const recipient = await User.findById(req.params.userId);

  if (!recipient) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng này');
  }

  if (sender._id.equals(recipient._id)) {
    res.status(400);
    throw new Error('Bạn không thể tự kết bạn với chính mình');
  }

  if (sender.friends.includes(recipient._id)) {
    res.status(400);
    throw new Error('Bạn và người này đã là bạn bè');
  }

  if (sender.sentFriendRequests.includes(recipient._id)) {
    res.status(400);
    throw new Error('Bạn đã gửi lời mời kết bạn cho người này rồi');
  }

  if (sender.receivedFriendRequests.includes(recipient._id)) {
    res.status(400);
    throw new Error('Người này đã gửi lời mời cho bạn. Hãy chấp nhận lời mời của họ.');
  }

  sender.sentFriendRequests.push(recipient._id);
  await sender.save();

  recipient.receivedFriendRequests.push(sender._id);
  await recipient.save();

  await Notification.create({
    recipient: recipient._id,
    sender: sender._id,
    type: 'friend_request',
  });

  res.status(200).json({ message: 'Đã gửi lời mời kết bạn thành công' });
});

// @desc    Chấp nhận lời mời kết bạn
// @route   POST /api/friends/accept-request/:senderId
// @access  Private
const acceptFriendRequest = asyncHandler(async (req, res) => {
  const recipient = await User.findById(req.user._id);
  const sender = await User.findById(req.params.senderId);

  if (!sender) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng này.');
  }

  if (!recipient.receivedFriendRequests.includes(sender._id)) {
    res.status(400);
    throw new Error('Bạn không có lời mời kết bạn từ người này.');
  }

  recipient.friends.push(sender._id);
  sender.friends.push(recipient._id);

  recipient.receivedFriendRequests = recipient.receivedFriendRequests.filter(
    (id) => !id.equals(sender._id)
  );
  sender.sentFriendRequests = sender.sentFriendRequests.filter(
    (id) => !id.equals(recipient._id)
  );

  await recipient.save();
  await sender.save();

  res.status(200).json({ message: 'Kết bạn thành công!' });
});

// @desc    Từ chối lời mời kết bạn
// @route   POST /api/friends/reject-request/:senderId
// @access  Private
const rejectFriendRequest = asyncHandler(async (req, res) => {
  const recipient = await User.findById(req.user._id);
  const sender = await User.findById(req.params.senderId);

  if (!sender) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng này.');
  }

  recipient.receivedFriendRequests = recipient.receivedFriendRequests.filter(
    (id) => !id.equals(sender._id)
  );
  sender.sentFriendRequests = sender.sentFriendRequests.filter(
    (id) => !id.equals(recipient._id)
  );

  await recipient.save();
  await sender.save();

  res.status(200).json({ message: 'Đã từ chối lời mời.' });
});

// ===== BẮT ĐẦU HÀM MỚI =====
// @desc    Hủy kết bạn
// @route   POST /api/friends/unfriend/:friendId
// @access  Private
const unfriendUser = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user._id);
  const friendToUnfriend = await User.findById(req.params.friendId);

  if (!friendToUnfriend) {
    res.status(404);
    throw new Error('Không tìm thấy người dùng này.');
  }

  if (!currentUser.friends.includes(friendToUnfriend._id)) {
    res.status(400);
    throw new Error('Bạn và người này không phải là bạn bè.');
  }

  // Xóa ID của nhau khỏi danh sách bạn bè
  currentUser.friends = currentUser.friends.filter(
    (id) => !id.equals(friendToUnfriend._id)
  );
  friendToUnfriend.friends = friendToUnfriend.friends.filter(
    (id) => !id.equals(currentUser._id)
  );

  await currentUser.save();
  await friendToUnfriend.save();

  res.status(200).json({ message: 'Đã hủy kết bạn thành công.' });
});
// ===== KẾT THÚC HÀM MỚI =====

// ===== CẬP NHẬT DÒNG EXPORT =====
export { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, unfriendUser };
