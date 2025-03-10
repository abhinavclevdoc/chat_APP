const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app); // Create an HTTP server

app.use(express.json());
app.use(cors());


// **Basic API Route**
app.get("/get", (req, res) => {
  res.status(200).send("Hello Chat APP...");
});


// **Socket.io for Real-time Chat & Video**
const io = new Server(server, {
  cors: { origin: "*" }
});

// Keep track of users in each room
const roomUsers = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join-room", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on("chat-message", (msg) => {
    console.log(`Message in room ${msg.roomName}:`, msg);
    io.to(msg.roomName).emit("chat-message", msg);
  });

  socket.on("join-video", (data) => {
    console.log(`join-video event from ${data.userName}:`, data);

    if (data.uid) {
      console.log(`${data.userName} joined room ${data.roomName} with UID ${data.uid}`);
      socket.join(data.roomName);

      // Initialize room users object if it doesn't exist
      if (!roomUsers[data.roomName]) {
        roomUsers[data.roomName] = {};
      }

      // Store this user's info
      roomUsers[data.roomName][data.uid] = {
        userName: data.userName,
        socketId: socket.id
      };

      // Send all existing users to the newly joined user
      const existingUsers = Object.entries(roomUsers[data.roomName])
        .filter(([uid]) => uid !== data.uid.toString())
        .map(([uid, userData]) => ({
          uid: parseInt(uid),
          userName: userData.userName
        }));

      console.log(`Sending existing users to ${data.userName}:`, existingUsers);
      socket.emit("existing-users", existingUsers);

      // Broadcast this user to all other users in the room
      socket.to(data.roomName).emit("user-connected", {
        uid: data.uid,
        userName: data.userName
      });
    } else {
      console.log(`Initial join from ${data.userName} (no UID yet)`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket ${socket.id} disconnected`);

    // Remove user from all rooms
    for (const room in roomUsers) {
      for (const uid in roomUsers[room]) {
        if (roomUsers[room][uid].socketId === socket.id) {
          console.log(`Removing user ${uid} from room ${room}`);
          delete roomUsers[room][uid];

          // If room is empty, remove it
          if (Object.keys(roomUsers[room]).length === 0) {
            delete roomUsers[room];
          }

          // No need to continue searching
          break;
        }
      }
    }
  });
});

// **Start the Server**
const PORT = process.env.PORT || 9001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});