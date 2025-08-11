const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cors());

// Basic API Route
app.get("/get", (req, res) => {
  res.status(200).send("Hello Chat APP new changes...");
});

// Socket.io Configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io",
  transports: ['websocket', 'polling']
});

// Room tracking
const activeRooms = new Map();

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Join room handler
  const joinRoom = (roomName) => {
    socket.join(roomName);
    console.log(`User ${socket.id} joined room: ${roomName}`);

    // Initialize room if not exists
    if (!activeRooms.has(roomName)) {
      activeRooms.set(roomName, new Map());
    }
  };

  // Leave room handler (not directly used now, but kept for future use)
  const leaveRoom = (roomName) => {
    socket.leave(roomName);
    console.log(`User ${socket.id} left room: ${roomName}`);

    if (activeRooms.has(roomName) && activeRooms.get(roomName).size === 0) {
      activeRooms.delete(roomName);
    }
  };

  // Chat message handler
  socket.on("chat-message", (msg) => {
    try {
      const roomName = msg.roomName;
      if (socket.rooms.has(roomName)) {
        console.log(`Message in ${roomName} from ${msg.sender}:`, msg.text);

        const serverMsg = {
          ...msg,
          timestamp: new Date().toISOString(),
          delivered: true
        };

        // Send to others
        socket.to(roomName).emit("chat-message", serverMsg);
        // Send back to sender
        socket.emit("message-delivered", serverMsg);
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  });

  // User join handler
  socket.on("join-room", (data) => {
    try {
      const { roomName, userName } = data;
      if (!roomName || !userName) return;

      joinRoom(roomName);

      const userData = {
        userName,
        socketId: socket.id,
        joinedAt: new Date(),
        uid: data.uid || Date.now()
      };

      activeRooms.get(roomName).set(socket.id, userData);

      socket.to(roomName).emit("user-connected", userData);

      const roomUsers = Array.from(activeRooms.get(roomName).values())
        .filter(user => user.socketId !== socket.id);

      socket.emit("room-info", {
        users: roomUsers,
        room: roomName
      });
    } catch (error) {
      console.error("Join error:", error);
    }
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    Array.from(socket.rooms).forEach(roomName => {
      if (roomName !== socket.id) {
        if (activeRooms.has(roomName)) {
          activeRooms.get(roomName).delete(socket.id);
          socket.to(roomName).emit("user-disconnected", {
            socketId: socket.id
          });
        }
      }
    });
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});