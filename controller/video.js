import { upload } from "../lib/config.multer.js";
import { v4 as uuidv4 } from "uuid";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { io } from "../server/app.js";
import mime from "mime";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "../output");

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

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

export const uploadVideo = (req, res) => {
  // Configure upload middleware first
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

    // Get video duration first
    try {
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, metadata) => {
          if (err) {
            console.error("FFprobe error:", err);
            if (err.message.includes("Cannot find ffprobe")) {
              reject(new Error("FFmpeg/FFprobe is not installed. Please install FFmpeg with FFprobe."));
            } else {
              reject(err);
            }
          } else {
            resolve(metadata);
          }
        });
      });
      
      const rawDuration = metadata.format.duration;
      duration = formatDuration(rawDuration);
      console.log("Video duration:", duration.formatted);
    } catch (error) {
      console.error("Error getting video metadata:", error);
      // Clean up uploaded file
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting uploaded file:", unlinkErr);
      });
      return res.status(500).json({
        success: false,
        message: error.message || "Error getting video metadata",
      });
    }

    // Access socketId after middleware has processed the request
    if (!req.body.socketId) {
      return res.status(400).json({ message: "Socket ID is required" });
    }

    const folderId = req.body.socketId;
    const outputPath = path.join(outputDir, folderId);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Rest of your existing code...
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
        "resolution": "740x420",
        "bitrate": "1200k",
        "maxrate": "1298k",
        "bufsize": "1800k",
        "file": "420p.m3u8",
        "name": "420",
        "segments": "420p_%03d.ts"
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
      //.on("start", (cmd) => console.log("FFmpeg command:", cmd))  
      /*ffmpeg -i D:\project\personal\youtube\backend\uploads\3f01406d-72e9-44bf-b6d4-54c369365c37\Screen Recording 2025-01-24 134843.mp4 -y -acodec aac -vcodec libx264 -filter:v scale=w=640:h=360 -b:v 800k -maxrate:v 856k -bufsize:v 1200k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\360p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\360p.m3u8 -acodec aac -vcodec libx264 -filter:v scale=w=740:h=420 -b:v 1200k -maxrate:v 1298k -bufsize:v 1800k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\420p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\420p.m3u8 -acodec aac -vcodec libx264 -filter:v scale=w=1280:h=720 -b:v 2800k -maxrate:v 2996k -bufsize:v 4200k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\720p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\720p.m3u8 -acodec aac -vcodec libx264 -filter:v scale=w=1920:h=1080 -b:v 5000k -maxrate:v 5350k -bufsize:v 7500k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\1080p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\1080p.m3u8*/
      .on("progress", (progress) => {
        const percent = Math.floor(progress.percent || 0);
        io.to(folderId).emit("progress", { percent });
      })
      .on("end", () => {
        // Generate the master.m3u8 file
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
        
        io.to(folderId).emit("completed", { 
          duration: duration.formatted,
          durationDetails: {
            hours: duration.hours,
            minutes: duration.minutes,
            seconds: duration.seconds,
            rawSeconds: duration
          }
        });
        
        // Clean up the uploaded file
        fs.rm(req.file.path, { recursive: true, force: true }, (err) => {
          if (err) {
            console.error("Error deleting uploaded file:", err);
          } else {
            console.log("Uploaded file deleted successfully.");
          }
        });
        
        res.status(200).json({
          success: true,
          message:
            "Video transcoding complete. Check the output folder for HLS files.",
          id: folderId, // Provide the folderId for retrieval
          duration: duration.formatted,
          durationDetails: {
            hours: duration.hours,
            minutes: duration.minutes,
            seconds: duration.seconds,
            rawSeconds: duration
          }
        });
      })
      .on("error", (err) => {
        console.error("Error during transcoding:", err);
        res.status(500).json({
          success: false,
          message: "Transcoding failed",
        });
      })
      .run();
  });
};

export const get_video = async (req, res) => {
  try {
    const videoId = req.params.id;
    const fileName = req.params.filename;  // Handle different file names dynamically

    const videoPath = path.join(outputDir, videoId, fileName);

    if (fs.existsSync(videoPath)) {
      const contentType = mime.getType(videoPath) || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');

      res.sendFile(videoPath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          res.status(500).json({ success: false, message: 'Error serving the file' });
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
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
    console.log("videoId", videoId);
    const fileName = req.params.filename;  // Handle different file names dynamically
    console.log("videoId", videoId);

    const videoPath = path.join(outputDir, videoId, "master.m3u8");

    if (fs.existsSync(videoPath)) {
      const contentType = mime.getType(videoPath) || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', `${process.env.CLINT_URL}${process.env.PORT}`);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      res.sendFile(videoPath, (err) => {
        if (err) {
          console.error('Error sending file:', err);
          res.status(500).json({ success: false, message: 'Error serving the file' });
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
  } catch (err) {
    console.error('Error fetching video:', err);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}



export const uploadVideoWithoutSocket = (req, res) => {
  // Configure upload middleware first
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

    // Get video duration first
    try {
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, metadata) => {
          if (err) {
            console.error("FFprobe error:", err);
            if (err.message.includes("Cannot find ffprobe")) {
              reject(new Error("FFmpeg/FFprobe is not installed. Please install FFmpeg with FFprobe."));
            } else {
              reject(err);
            }
          } else {
            resolve(metadata);
          }
        });
      });
      
      const rawDuration = metadata.format.duration;
      duration = formatDuration(rawDuration);
      console.log("Video duration:", duration.formatted);
    } catch (error) {
      console.error("Error getting video metadata:", error);
      // Clean up uploaded file
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting uploaded file:", unlinkErr);
      });
      return res.status(500).json({
        success: false,
        message: error.message || "Error getting video metadata",
      });
    }


    const folderId = uuidv4();
    const outputPath = path.join(outputDir, folderId);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Rest of your existing code...
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
        "resolution": "740x420",
        "bitrate": "1200k",
        "maxrate": "1298k",
        "bufsize": "1800k",
        "file": "420p.m3u8",
        "name": "420",
        "segments": "420p_%03d.ts"
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
      //.on("start", (cmd) => console.log("FFmpeg command:", cmd))  
      /*ffmpeg -i D:\project\personal\youtube\backend\uploads\3f01406d-72e9-44bf-b6d4-54c369365c37\Screen Recording 2025-01-24 134843.mp4 -y -acodec aac -vcodec libx264 -filter:v scale=w=640:h=360 -b:v 800k -maxrate:v 856k -bufsize:v 1200k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\360p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\360p.m3u8 -acodec aac -vcodec libx264 -filter:v scale=w=740:h=420 -b:v 1200k -maxrate:v 1298k -bufsize:v 1800k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\420p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\420p.m3u8 -acodec aac -vcodec libx264 -filter:v scale=w=1280:h=720 -b:v 2800k -maxrate:v 2996k -bufsize:v 4200k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\720p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\720p.m3u8 -acodec aac -vcodec libx264 -filter:v scale=w=1920:h=1080 -b:v 5000k -maxrate:v 5350k -bufsize:v 7500k -hls_time 5 -hls_playlist_type vod -hls_segment_filename D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\1080p_%03d.ts D:\project\personal\youtube\backend\output\3f01406d-72e9-44bf-b6d4-54c369365c37\1080p.m3u8*/
      /*.on("progress", (progress) => {
        const percent = Math.floor(progress.percent || 0);
      })*/
      .on("end", () => {
        // Generate the master.m3u8 file
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
        
      
        
        // Clean up the uploaded file
        fs.rm(req.file.path, { recursive: true, force: true }, (err) => {
          if (err) {
            console.error("Error deleting uploaded file:", err);
          } else {
            console.log("Uploaded file deleted successfully.");
          }
        });
        
        res.status(200).json({
          success: true,
          message:
            "Video transcoding complete. Check the output folder for HLS files.",
          id: folderId, // Provide the folderId for retrieval
          duration: duration.formatted,
          durationDetails: {
            hours: duration.hours,
            minutes: duration.minutes,
            seconds: duration.seconds,
            rawSeconds: duration
          }
        });
      })
      .on("error", (err) => {
        console.error("Error during transcoding:", err);
        res.status(500).json({
          success: false,
          message: "Transcoding failed",
        });
      })
      .run();
  });
};
