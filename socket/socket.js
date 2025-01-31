export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("upload_started", (data) => {
      console.log(`Upload started by ${socket.id}:`, data);
      socket.emit("upload_progress", { progress: 0 });
    });

    socket.on("join_room", (room) => {
      console.log(`Joining room ${room}`);
      socket.join(room);
    });

    socket.on("disconnect", () => {
      socket.leave(socket.id);
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};
