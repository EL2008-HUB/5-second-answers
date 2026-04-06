const shareVideoService = require("../services/shareVideoService");

exports.exportAnswerVideo = async (req, res) => {
  try {
    const result = await shareVideoService.exportAnswerVideo({
      answer: req.body?.answer,
      aiComment: req.body?.aiComment,
      question: req.body?.question,
      seconds: req.body?.seconds,
    });

    res.status(201).json({
      success: true,
      video: result,
    });
  } catch (error) {
    console.error("Share video export failed:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to export share video",
    });
  }
};
