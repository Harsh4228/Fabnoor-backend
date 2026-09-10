import multer from "multer";

// Files are kept in memory (as a Buffer) and streamed straight to Cloudinary —
// no local disk writes, which is required on serverless/ephemeral filesystems.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only video files allowed"), false);
  }
};

export const uploadVideo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});
