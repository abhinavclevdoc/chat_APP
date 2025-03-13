// const express = require("express");
// const cors = require("cors");
// const { createServer } = require("http");
// const { Server } = require("socket.io");

// const app = express();
// const server = createServer(app); // Create an HTTP server

// app.use(express.json());
// app.use(cors());


// // **Basic API Route**
// app.get("/get", (req, res) => {
//   res.status(200).send("Hello Chat APP...");
// });


// // **Socket.io for Real-time Chat & Video**
// const io = new Server(server, {
//   cors: { origin: "*" }
// });

// // Keep track of users in each room
// const roomUsers = {};

// io.on("connection", (socket) => {
//   console.log("A user connected:", socket.id);

//   socket.on("join-room", (room) => {
//     socket.join(room);
//     console.log(`User joined room: ${room}`);
//   });

//   socket.on("chat-message", (msg) => {
//     console.log(`Message in room ${msg.roomName}:`, msg);
//     io.to(msg.roomName).emit("chat-message", msg);
//   });

//   socket.on("join-video", (data) => {
//     console.log(`join-video event from ${data.userName}:`, data);

//     if (data.uid) {
//       console.log(`${data.userName} joined room ${data.roomName} with UID ${data.uid}`);
//       socket.join(data.roomName);

//       // Initialize room users object if it doesn't exist
//       if (!roomUsers[data.roomName]) {
//         roomUsers[data.roomName] = {};
//       }

//       // Store this user's info
//       roomUsers[data.roomName][data.uid] = {
//         userName: data.userName,
//         socketId: socket.id
//       };

//       // Send all existing users to the newly joined user
//       const existingUsers = Object.entries(roomUsers[data.roomName])
//         .filter(([uid]) => uid !== data.uid.toString())
//         .map(([uid, userData]) => ({
//           uid: parseInt(uid),
//           userName: userData.userName
//         }));

//       console.log(`Sending existing users to ${data.userName}:`, existingUsers);
//       socket.emit("existing-users", existingUsers);

//       // Broadcast this user to all other users in the room
//       socket.to(data.roomName).emit("user-connected", {
//         uid: data.uid,
//         userName: data.userName
//       });
//     } else {
//       console.log(`Initial join from ${data.userName} (no UID yet)`);
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log(`Socket ${socket.id} disconnected`);

//     // Remove user from all rooms
//     for (const room in roomUsers) {
//       for (const uid in roomUsers[room]) {
//         if (roomUsers[room][uid].socketId === socket.id) {
//           console.log(`Removing user ${uid} from room ${room}`);
//           delete roomUsers[room][uid];

//           // If room is empty, remove it
//           if (Object.keys(roomUsers[room]).length === 0) {
//             delete roomUsers[room];
//           }

//           // No need to continue searching
//           break;
//         }
//       }
//     }
//   });
// });

// // **Start the Server**
// const PORT = process.env.PORT || 5001;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });



// above is deployed code here.....

// below code is previous working on the aws deployments...

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

  // Leave room handler
  const leaveRoom = (roomName) => {
    socket.leave(roomName);
    console.log(`User ${socket.id} left room: ${roomName}`);
    
    // Cleanup empty rooms
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
        
        // Add timestamp on server side
        const serverMsg = {
          ...msg,
          timestamp: new Date().toISOString(),
          delivered: true
        };

        // Broadcast to room (excluding sender)
        socket.to(roomName).emit("chat-message", serverMsg);
        // Send confirmation to sender
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
      
      // Store user info
      const userData = {
        userName,
        socketId: socket.id,
        joinedAt: new Date(),
        uid: data.uid || Date.now()
      };

      // Add user to room
      activeRooms.get(roomName).set(socket.id, userData);

      // Notify others
      socket.to(roomName).emit("user-connected", userData);

      // Send room info to new user
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
    
    // Remove from all rooms
    Array.from(socket.rooms).forEach(roomName => {
      if (roomName !== socket.id) { // Skip default room
        if (activeRooms.has(roomName)) {
          activeRooms.get(roomName).delete(socket.id);
          socket.to(roomName).emit("user-disconnected", {
            socketId: socket.id
          });
        }
      }
    });
  });

  // Error handling
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



// const express = require("express");
// const cors = require("cors");
// const { createServer } = require("http");
// const { Server } = require("socket.io");

// const app = express();
// const server = createServer(app);

// app.use(express.json());
// app.use(cors());

// // Basic health check route
// app.get("/get", (req, res) => {
//   res.status(200).json({ status: "ok", message: "Chat API running" });
// });

// // Socket.IO configuration
// const io = new Server(server, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//     credentials: true
//   },
//   path: "/socket.io",
//   transports: ['websocket', 'polling']
// });

// // Room management
// const activeRooms = new Map();

// io.on("connection", (socket) => {
//   console.log("New connection:", socket.id);

//   // Handle joining room
//   socket.on("join-room", (data) => {
//     try {
//       const { roomName, userName, uid } = data;
//       if (!roomName || !userName) return;

//       // Join the room
//       socket.join(roomName);
//       console.log(`${userName} joined ${roomName}`);

//       // Initialize room if not exists
//       if (!activeRooms.has(roomName)) {
//         activeRooms.set(roomName, new Map());
//       }

//       // Store user info
//       const userData = {
//         userName,
//         socketId: socket.id,
//         uid: uid || Date.now(),
//         joinedAt: new Date()
//       };
//       activeRooms.get(roomName).set(socket.id, userData);

//       // Notify others in the room
//       socket.to(roomName).emit("user-connected", userData);

//       // Send current room users to the new member
//       const roomUsers = Array.from(activeRooms.get(roomName).values())
//         .filter(user => user.socketId !== socket.id);
      
//       socket.emit("room-info", {
//         users: roomUsers,
//         room: roomName
//       });
//     } catch (error) {
//       console.error("Join error:", error);
//     }
//   });

//   // Handle chat messages
//   socket.on("chat-message", (msg) => {
//     try {
//       const roomName = msg.roomName;
//       if (socket.rooms.has(roomName)) {
//         const finalMsg = {
//           ...msg,
//           timestamp: new Date().toISOString(),
//           delivered: true
//         };

//         // Broadcast to room (excluding sender)
//         socket.to(roomName).emit("chat-message", finalMsg);
//         // Confirm delivery to sender
//         socket.emit("message-delivered", finalMsg);
//       }
//     } catch (error) {
//       console.error("Message handling error:", error);
//     }
//   });

//   // Handle disconnections
//   socket.on("disconnect", () => {
//     console.log("Disconnected:", socket.id);
//     activeRooms.forEach((users, roomName) => {
//       if (users.has(socket.id)) {
//         users.delete(socket.id);
//         socket.to(roomName).emit("user-disconnected", { socketId: socket.id });
        
//         // Clean empty rooms
//         if (users.size === 0) {
//           activeRooms.delete(roomName);
//         }
//       }
//     });
//   });

//   // Error handling
//   socket.on("error", (error) => {
//     console.error("Socket error:", error);
//   });
// });

// const PORT = process.env.PORT || 5001;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });