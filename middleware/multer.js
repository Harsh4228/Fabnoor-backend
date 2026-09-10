import multer from "multer";

// Files are kept in memory (as a Buffer) and streamed straight to Cloudinary —
// no local disk writes, which is required on serverless/ephemeral filesystems.
const storage = multer.memoryStorage();

// Allow only image files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
});

export default upload;
