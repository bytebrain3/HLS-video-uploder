import { upload } from "../lib/config.multer.js";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { io } from "../server/app.js";
import mime from "mime";
import dotenv from 'dotenv';
import { put, del } from '@vercel/blob';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add this to verify the token is loaded
console.log('BLOB Token available:', !!process.env.BLOB_READ_WRITE_TOKEN);

const outputDir = path.join(__dirname, "../output");

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const blobOptions = {
  access: 'public',
  token: process.env.BLOB_READ_WRITE_TOKEN
};

export const uploadVideo = (req, res) => {
  const uploadMiddleware = upload.single("video");
  let duration = 0;

  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    try {
      // Get video duration first
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, metadata) => {
          if (err) {
            console.error("FFprobe error:", err);
            reject(err);
          } else {
            resolve(metadata);
          }
        });
      });
      
      const rawDuration = metadata.format.duration;
      duration = formatDuration(rawDuration);

      const folderId = req.body.socketId || uuidv4();
      const outputPath = path.join(outputDir, folderId);

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      const qualities = [
        {
          resolution: "640x360",
          bitrate: "800k",
          maxrate: "856k",
          bufsize: "1200k",
          file: "360p.m3u8",
          name: "360",
          segments: "360p_%03d.ts",
        },
        {
          resolution: "740x420",
          bitrate: "1200k",
          maxrate: "1298k",
          bufsize: "1800k",
          file: "420p.m3u8",
          name: "420",
          segments: "420p_%03d.ts"
        },
        {
          resolution: "1280x720",
          bitrate: "2800k",
          maxrate: "2996k",
          bufsize: "4200k",
          file: "720p.m3u8",
          name: "720",
          segments: "720p_%03d.ts",
        },
        {
          resolution: "1920x1080",
          bitrate: "5000k",
          maxrate: "5350k",
          bufsize: "7500k",
          file: "1080p.m3u8",
          name: "1080",
          segments: "1080p_%03d.ts",
        },
      ];

      const ffmpegCommand = ffmpeg(req.file.path);

      qualities.forEach((quality) => {
        ffmpegCommand
          .output(path.join(outputPath, quality.file))
          .videoCodec("libx264")
          .audioCodec("aac")
          .size(quality.resolution)
          .outputOptions([
            `-b:v ${quality.bitrate}`,
            `-maxrate:v ${quality.maxrate}`,
            `-bufsize:v ${quality.bufsize}`,
            "-hls_time 2",
            "-hls_playlist_type vod",
            `-hls_segment_filename ${path.join(outputPath, quality.segments)}`,
          ]);
      });

      ffmpegCommand
        .on("progress", (progress) => {
          const percent = Math.floor(progress.percent || 0);
          if (req.body.socketId) {
            io.to(folderId).emit("progress", { percent });
          }
        })
        .on("end", async () => {
          try {
            const masterPlaylistPath = path.join(outputPath, "master.m3u8");
            const masterPlaylistContent = qualities
              .map(
                (quality) =>
                  `#EXT-X-STREAM-INF:BANDWIDTH=${
                    parseInt(quality.bitrate) * 1000
                  },RESOLUTION=${quality.resolution}\n${quality.file}`
              )
              .join("\n");

            const masterPlaylistHeader = "#EXTM3U\n";
            fs.writeFileSync(
              masterPlaylistPath,
              masterPlaylistHeader + masterPlaylistContent
            );

            const uploadPromises = [];
            const fileUrls = {};

            // Upload master playlist
            const masterContent = fs.readFileSync(masterPlaylistPath);
            const masterBlob = await put(`videos/${folderId}/master.m3u8`, masterContent, {
              ...blobOptions,
              contentType: 'application/vnd.apple.mpegurl'
            });
            fileUrls.master = masterBlob.url;

            // Upload quality-specific m3u8 and ts files
            for (const quality of qualities) {
              const m3u8Path = path.join(outputPath, quality.file);
              const m3u8Content = fs.readFileSync(m3u8Path);
              
              const m3u8Blob = await put(`videos/${folderId}/${quality.file}`, m3u8Content, {
                ...blobOptions,
                contentType: 'application/vnd.apple.mpegurl'
              });
              fileUrls[quality.name] = m3u8Blob.url;

              // Upload all ts segments for this quality
              const segmentFiles = fs.readdirSync(outputPath)
                .filter(file => file.startsWith(`${quality.name}p_`) && file.endsWith('.ts'));

              for (const segment of segmentFiles) {
                const segmentPath = path.join(outputPath, segment);
                const segmentContent = fs.readFileSync(segmentPath);
                
                const segmentBlob = await put(`videos/${folderId}/${segment}`, segmentContent, {
                  ...blobOptions,
                  contentType: 'video/MP2T'
                });
                uploadPromises.push(segmentBlob);
              }
            }

            await Promise.all(uploadPromises);

            // Clean up local files
            fs.rm(outputPath, { recursive: true, force: true }, (err) => {
              if (err) console.error("Error deleting output directory:", err);
            });

            fs.rm(req.file.path, { recursive: true, force: true }, (err) => {
              if (err) console.error("Error deleting uploaded file:", err);
            });

            // Send response
            const response = {
              success: true,
              message: "Video processing complete",
              id: folderId,
              duration: duration.formatted,
              durationDetails: {
                hours: duration.hours,
                minutes: duration.minutes,
                seconds: duration.seconds,
                rawSeconds: duration
              },
              urls: fileUrls
            };

            if (req.body.socketId) {
              io.to(folderId).emit("completed", response);
            }

            res.status(200).json(response);

          } catch (error) {
            console.error("Error in upload process:", error);
            res.status(500).json({
              success: false,
              message: error.message || "Failed to upload files to storage"
            });
          }
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          res.status(500).json({
            success: false,
            message: "Transcoding failed: " + err.message
          });
        })
        .run();

    } catch (error) {
      console.error("Error in upload process:", error);
      res.status(500).json({
        success: false,
        message: error.message || "An unexpected error occurred"
      });
    }
  });
};

export const get_video = async (req, res) => {
  try {
    const videoId = req.params.id;
    const fileName = req.params.filename;
    
    const blobUrl = `https://youtube-frontend-blob.vercel.app/videos/${videoId}/${fileName}`;
    res.redirect(blobUrl);
  } catch (err) {
    console.error('Error fetching video:', err);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

export const get_m3u8 = async (req, res) => {
  try {
    const videoId = req.params.id;
    const masterPlaylistUrl = `https://youtube-frontend-blob.vercel.app/videos/${videoId}/master.m3u8`;
    res.redirect(masterPlaylistUrl);
  } catch (err) {
    console.error('Error fetching m3u8:', err);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

export const deleteVideo = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Video ID is required"
      });
    }

    const filePatterns = [
      'master.m3u8',
      '360p.m3u8', '360p_*.ts',
      '420p.m3u8', '420p_*.ts',
      '720p.m3u8', '720p_*.ts',
      '1080p.m3u8', '1080p_*.ts'
    ];

    const deletePromises = filePatterns.map(async (pattern) => {
      try {
        if (!pattern.includes('*')) {
          await del(`videos/${id}/${pattern}`, blobOptions);
        }
      } catch (error) {
        console.error(`Error deleting ${pattern}:`, error);
      }
    });

    await Promise.all(deletePromises);

    return res.status(200).json({
      success: true,
      message: "Video deleted successfully"
    });

  } catch (error) {
    console.error('Error in deleteVideo:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting video"
    });
  }
};

// Add this utility function at the top of the file
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
