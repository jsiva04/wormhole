const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { join } = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(__dirname));

// Serve the HTML file
app.get('/', (_, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Socket.IO signaling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', socket.id);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Relay offer
  socket.on('offer', (data) => {
    socket.to(data.to).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  // Relay answer
  socket.on('answer', (data) => {
    socket.to(data.to).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  // Relay ICE candidates
  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    io.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});