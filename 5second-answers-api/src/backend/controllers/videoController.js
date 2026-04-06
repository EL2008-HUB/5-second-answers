const videos = require("../models/Video");

exports.getVideos = (req, res) => {
  console.log("🎬 getVideos called");
  console.log("📦 videos:", videos);

  res.status(200).json(videos);
};

exports.likeVideo = (req, res) => {
  const { id } = req.params;

  const video = videos.find(v => v.id === id);
  if (!video) {
    return res.status(404).json({ message: "Video not found" });
  }

  video.likes += 1;
  res.status(200).json(video);
};
