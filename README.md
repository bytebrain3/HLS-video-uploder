# HLS Video Uploader

A modern Node.js backend service for processing and streaming video content using HTTP Live Streaming (HLS) protocol.

## Overview

This project provides a robust solution for video processing and adaptive streaming. It takes uploaded videos, transcodes them into multiple quality levels (360p, 420p, 720p, 1080p), and generates HLS playlists for adaptive streaming. The processed content is then stored in cloud storage (using Vercel Blob Storage) for delivery to users.

## Features

- Upload video files via REST API
- Real-time progress monitoring with WebSocket (Socket.IO)
- Automatic video transcoding to multiple resolutions
- HLS playlist generation for adaptive bitrate streaming
- Cloud storage integration with Vercel Blob Storage
- RESTful API for video management

## Use Cases

- Video-on-demand platforms
- Online courses with video content
- Live streaming applications
- Media sharing platforms
- Video content management systems
- User-generated content platforms

## How It Works

### System Architecture

1. **Backend Server**: Express.js application handling HTTP requests
2. **Socket Server**: Socket.IO for real-time progress updates
3. **Transcoding Engine**: FFmpeg for video processing
4. **Storage**: Vercel Blob Storage for hosting processed content

### Workflow Steps

1. Client uploads a video file to the `/upload` endpoint
2. Server receives the file and saves it temporarily
3. FFmpeg transcodes the video to multiple quality levels (360p, 420p, 720p, 1080p)
4. During transcoding, progress updates are sent to the client via WebSockets
5. HLS playlists (.m3u8) and segments (.ts) are generated for each quality level
6. All files are uploaded to Vercel Blob Storage
7. The server sends back URLs to access the processed content
8. Local temporary files are cleaned up automatically

## Setup and Usage

### Prerequisites

- Node.js (v14+)
- FFmpeg installed on the server
- Vercel Blob Storage account (or Cloudinary as alternative)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   pnpm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=3000
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
   ```

4. Start the development server:
   ```
   npm run dev
   ```
   or
   ```
   pnpm dev
   ```

### API Endpoints

#### Upload Video
- **URL**: `/upload`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `video`: The video file
  - `socketId` (optional): Socket ID for real-time progress updates

#### Response Format
```json
{
  "success": true,
  "message": "Video processing complete",
  "id": "unique-folder-id",
  "duration": "00:01:30",
  "durationDetails": {
    "hours": 0,
    "minutes": 1,
    "seconds": 30,
    "rawSeconds": 90.5
  },
  "urls": {
    "master": "https://cdn-url/videos/folder-id/master.m3u8",
    "360": "https://cdn-url/videos/folder-id/360p.m3u8",
    "420": "https://cdn-url/videos/folder-id/420p.m3u8",
    "720": "https://cdn-url/videos/folder-id/720p.m3u8",
    "1080": "https://cdn-url/videos/folder-id/1080p.m3u8"
  }
}
```

### Socket Events

- **join_room**: Join a specific room to receive updates
- **progress**: Receive transcoding progress updates
- **completed**: Receive notification when processing is finished

## Technologies Used

- Express.js - Web server framework
- Socket.IO - Real-time bidirectional event-based communication
- FFmpeg - Video processing and transcoding
- Multer - File upload middleware
- Vercel Blob Storage - Content delivery and storage
- UUID - Unique identifier generation

## Docker Support

This project includes a Dockerfile for containerized deployment:

```
docker build -t hls-video-uploader .
docker run -p 3000:3000 -e BLOB_READ_WRITE_TOKEN=your_token hls-video-uploader
```

## Use this as npm package
```bash
npm i video-hls-converter
```

## License

ISC
