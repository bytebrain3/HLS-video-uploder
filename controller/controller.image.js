import { upload } from "../lib/config.multer.js"
import  {cloudinary}  from "../lib/config.cloudinary.js";
import fs from "fs";

export const imageController = async (req, res) => {
  try {
    const uploadMiddleware = upload.single("thumbnail");

    // Use promise-based handling for uploadMiddleware
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ message: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }

      try {
        const result = await new Promise((resolve, reject) => {
          cloudinary.v2.uploader.upload(
            req.file.path,
            { folder: "thumbnail" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
        });

        await fs.promises.rm(req.file.path);

        return res.status(200).json({
          success: true,
          message: "Image uploaded successfully",
          data: result.secure_url
        });
      } catch (error) {
        console.error("Upload error:", error);
        return res.status(400).json({ message: error.message });
      }
    });
  } catch (err) {
    console.error('Error handling image upload:', err);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
