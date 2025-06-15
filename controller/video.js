import { upload } from "../lib/config.multer.js";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { io } from "../server/app.js";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, "../output");

// Ensure output directory exists
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

export const uploadVideo = (req, res) => {
  const uploadMiddleware = upload.single("video");
  let duration = 0;

  uploadMiddleware(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });

    try {
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, metadata) => {
          if (err) reject(err);
          else resolve(metadata);
        });
      });

      const rawDuration = metadata.format.duration;
      duration = formatDuration(rawDuration);

      const folderId = req.body.socketId || uuidv4();
      const outputPath = path.join(outputDir, folderId);
      if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });

      const qualities = [
        { resolution: "640x360", bitrate: "800k", maxrate: "856k", bufsize: "1200k", file: "360p.m3u8", name: "360", segments: "360p_%03d.ts" },
        { resolution: "740x420", bitrate: "1200k", maxrate: "1298k", bufsize: "1800k", file: "420p.m3u8", name: "420", segments: "420p_%03d.ts" },
        { resolution: "1280x720", bitrate: "2800k", maxrate: "2996k", bufsize: "4200k", file: "720p.m3u8", name: "720", segments: "720p_%03d.ts" },
        { resolution: "1920x1080", bitrate: "5000k", maxrate: "5350k", bufsize: "7500k", file: "1080p.m3u8", name: "1080", segments: "1080p_%03d.ts" },
      ];

      const ffmpegCommand = ffmpeg(req.file.path);
      qualities.forEach((quality) => {
        ffmpegCommand.output(path.join(outputPath, quality.file))
          .videoCodec("libx264")
          .audioCodec("aac")
          .size(quality.resolution)
          .outputOptions([
            `-b:v ${quality.bitrate}`,
            `-maxrate:v ${quality.maxrate}`,
            `-bufsize:v ${quality.bufsize}`,
            "-hls_time 2",
            "-hls_playlist_type vod",
            `-hls_segment_filename ${path.join(outputPath, quality.segments)}`
          ]);
      });

      ffmpegCommand
        .on("progress", (progress) => {
          const percent = Math.floor(progress.percent || 0);
          if (req.body.socketId) io.to(folderId).emit("progress", { percent });
        })
        .on("end", async () => {
          const masterPlaylistPath = path.join(outputPath, "master.m3u8");
          const masterPlaylistContent = qualities.map(q =>
            `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(q.bitrate) * 1000},RESOLUTION=${q.resolution}\n${q.file}`
          ).join("\n");

          const masterPlaylistHeader = "#EXTM3U\n";
          fs.writeFileSync(masterPlaylistPath, masterPlaylistHeader + masterPlaylistContent);

          const response = {
            success: true,
            message: "Video processing complete",
            id: folderId,
            duration: duration.formatted,
            durationDetails: duration,
            urls: {
              master: `/videos/${folderId}/master.m3u8`,
              ...Object.fromEntries(qualities.map(q => [q.name, `/videos/${folderId}/${q.file}`]))
            }
          };

          if (req.body.socketId) io.to(folderId).emit("completed", response);
          res.status(200).json(response);
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          res.status(500).json({ success: false, message: "Transcoding failed: " + err.message });
        })
        .run();

    } catch (error) {
      console.error("Processing error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

export const get_video = (req, res) => {
  const { id, filename } = req.params;
  const filePath = path.join(outputDir, id, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

  res.setHeader("Content-Type", mime.getType(filePath) || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
};

export const get_m3u8 = (req, res) => {
  const { id } = req.params;
  const masterPath = path.join(outputDir, id, "master.m3u8");
  if (!fs.existsSync(masterPath)) return res.status(404).send("Playlist not found");

  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  fs.createReadStream(masterPath).pipe(res);
};

export const deleteVideo = (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "Video ID is required" });

  const folderPath = path.join(outputDir, id);
  fs.rm(folderPath, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error("Delete error:", err);
      return res.status(500).json({ success: false, message: "Failed to delete video files" });
    }
    res.status(200).json({ success: true, message: "Video deleted successfully" });
  });
};

// Utility
const formatDuration = (durationInSeconds) => {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = Math.floor(durationInSeconds % 60);
  return {
    hours,
    minutes,
    seconds,
    formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  };
};
