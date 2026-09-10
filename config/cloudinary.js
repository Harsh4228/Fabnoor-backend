import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

const connectCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  console.log("Cloudinary connected");
};

// Uploads an in-memory buffer (e.g. from multer memoryStorage) to Cloudinary.
const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "image", ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

// Chunked upload for large files (videos) — avoids the ~100MB single-request limit.
const uploadLargeBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_large_stream(
      { resource_type: "video", chunk_size: 6 * 1024 * 1024, ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

// Derives the Cloudinary public_id from one of our stored secure_urls so we
// can delete assets without needing a separate public_id column everywhere.
const getCloudinaryPublicId = (url) => {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) {
    return null;
  }
  try {
    const afterUpload = url.split("/upload/")[1];
    if (!afterUpload) return null;
    const withoutVersion = afterUpload.replace(/^v\d+\//, "");
    return withoutVersion.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
};

// Best-effort delete — logs but never throws, so a missing/foreign URL never
// blocks the surrounding DB operation (e.g. removing a product/hero image).
const deleteFromCloudinaryByUrl = async (url, resourceType = "image") => {
  const publicId = getCloudinaryPublicId(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    console.error("Cloudinary delete failed:", e.message);
  }
};

export {
  cloudinary,          // 👈 IMPORTANT
  uploadBufferToCloudinary,
  uploadLargeBufferToCloudinary,
  getCloudinaryPublicId,
  deleteFromCloudinaryByUrl,
};
export default connectCloudinary;
