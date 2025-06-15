import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {setupSocket} from "../socket/socket.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

setupSocket(io);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());




// Add this to debug socket.io
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err);
});

export { app, io, httpServer };
