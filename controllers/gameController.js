
// Cách phổ biến: Lấy danh sách điểm cao từ collection Scores
exports.getLeaderboard = async (req, res) => {
  try {
    const { gameType } = req.params; // Ví dụ: 'snake', 'brick_breaker', '2048'

    // Tìm top 20 điểm cao nhất, sắp xếp giảm dần
    // .populate('user') để lấy tên và avatar người chơi
    const leaderboard = await Score.find({ gameType: gameType })
      .sort({ score: -1 }) 
      .limit(20)
      .populate('user', 'username avatarUrl'); 

    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy bảng xếp hạng", error });
  }
};