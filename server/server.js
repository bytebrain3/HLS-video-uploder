import dotenv from "dotenv"
dotenv.config()

import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import cors from "cors"; // Corrected import
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

import videoRouter from "../router/route.video.js"
import imageRouter from "../router/route.image.js"
import { app, httpServer } from "./app.js"


const port = process.env.PORT || 3000;
app.use((req, res, next) => {
  console.log("Request to static path:", req.originalUrl);
  next();
});






app.use(express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, "../output")));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:3000"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Disposition'],
  maxAge: 86400 // 24 hours
}));

app.use((req, res, next) => {
  res.setHeader("Accept-Ranges", "bytes");
  next();
});
app.use((req, res, next) => {
  console.log(`${req.method} request made to: ${req.originalUrl}`);
  if (req.method === "POST" || req.method === "PUT") {
    console.log("Request Body:", req.body);
  }
  next();
});

app.use('/api/v1/video/',videoRouter)
app.use('/api/v1/image/',imageRouter)


app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});