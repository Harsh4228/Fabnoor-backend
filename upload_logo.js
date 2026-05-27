import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const logoPath = path.join(__dirname, "..", "Fabnoor-Frontend", "public", "logo.png");

console.log("Uploading logo from:", logoPath);

const result = await cloudinary.uploader.upload(logoPath, {
  public_id: "fabnoor_logo",
  overwrite: true,
  folder: "fabnoor",
});

console.log("\n✅ Logo uploaded successfully!");
console.log("Public URL:", result.secure_url);
console.log("\nAdd this to your .env:");
console.log(`WHATSAPP_HEADER_IMAGE_URL=${result.secure_url}`);
