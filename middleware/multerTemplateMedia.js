import multer from "multer";

// WhatsApp template header media: image, video or PDF document.
// Kept in memory and streamed to Cloudinary (no local disk on serverless).
const ALLOWED = ["image/jpeg", "image/png", "video/mp4", "video/3gpp", "application/pdf"];

const uploadTemplateMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG/PNG images, MP4 videos or PDF documents are allowed"), false);
  },
  limits: { fileSize: 16 * 1024 * 1024 }, // WhatsApp's video limit; images are capped at 5MB by Meta
});

export default uploadTemplateMedia;
