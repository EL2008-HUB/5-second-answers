const getUploadedFile = (req) =>
  req.file ||
  req.files?.media?.[0] ||
  req.files?.video?.[0] ||
  req.files?.audio?.[0] ||
  null;

exports.uploadMedia = (req, res) => {
  const file = getUploadedFile(req);

  if (!file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const protocol = req.protocol || "http";
  const host = req.get("host");
  const fileUrl = `${protocol}://${host}/uploads/${file.filename}`;

  res.status(201).json({
    message: "File uploaded successfully",
    url: fileUrl,
    originalName: file.originalname,
    mimeType: file.mimetype || null,
  });
};
