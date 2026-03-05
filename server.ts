import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const PORT = 3000;

  // Room state
  // rooms[roomId] = { players: { socketId: { id, name, color, ready } }, chat: [] }
  const rooms: Record<string, any> = {};

  const COLORS = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Orange', value: '#f97316' },
  ];

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, playerName }) => {
      if (!rooms[roomId]) {
        rooms[roomId] = {
          id: roomId,
          players: {},
          chat: [],
          gameState: 'lobby',
          mapId: 'forest'
        };
      }

      const room = rooms[roomId];
      if (Object.keys(room.players).length >= 4) {
        socket.emit("error", "Room is full");
        return;
      }

      // Find an available color
      const usedColors = Object.values(room.players).map((p: any) => p.color);
      const availableColor = COLORS.find(c => !usedColors.includes(c.value))?.value || COLORS[0].value;

      room.players[socket.id] = {
        id: socket.id,
        name: playerName || `Player ${Object.keys(room.players).length + 1}`,
        color: availableColor,
        ready: false,
        score: 0,
        wins: 0
      };

      socket.join(roomId);
      io.to(roomId).emit("room-update", room);
      
      // Send system message
      const systemMsg = {
        id: Date.now().toString(),
        sender: "System",
        text: `${room.players[socket.id].name} joined the room`,
        timestamp: new Date().toLocaleTimeString()
      };
      room.chat.push(systemMsg);
      io.to(roomId).emit("chat-message", systemMsg);
    });

    socket.on("select-color", ({ roomId, color }) => {
      const room = rooms[roomId];
      if (!room) return;

      // Check if color is taken
      const isTaken = Object.values(room.players).some((p: any) => p.id !== socket.id && p.color === color);
      if (isTaken) {
        socket.emit("error", "Color already taken");
        return;
      }

      if (room.players[socket.id]) {
        room.players[socket.id].color = color;
        io.to(roomId).emit("room-update", room);
      }
    });

    socket.on("send-chat", ({ roomId, text }) => {
      const room = rooms[roomId];
      if (!room || !room.players[socket.id]) return;

      const msg = {
        id: Date.now().toString(),
        sender: room.players[socket.id].name,
        text,
        timestamp: new Date().toLocaleTimeString()
      };
      room.chat.push(msg);
      io.to(roomId).emit("room-update", room);
      io.to(roomId).emit("chat-message", msg);
    });

    socket.on("toggle-ready", ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || !room.players[socket.id]) return;

      room.players[socket.id].ready = !room.players[socket.id].ready;
      io.to(roomId).emit("room-update", room);

      // Check if all ready
      const players = Object.values(room.players);
      if (players.length >= 2 && players.every((p: any) => p.ready)) {
        room.gameState = 'playing';
        io.to(roomId).emit("start-game", { mapId: room.mapId });
      }
    });

    // Game synchronization
    socket.on("player-update", ({ roomId, playerState }) => {
      socket.to(roomId).emit("remote-player-update", {
        id: socket.id,
        ...playerState
      });
    });

    socket.on("projectile-fired", ({ roomId, projectile }) => {
      socket.to(roomId).emit("remote-projectile-fired", projectile);
    });

    socket.on("player-hit", ({ roomId, targetId, damage, attackerId }) => {
      const room = rooms[roomId];
      if (!room) return;
      
      const target = room.players[targetId];
      if (target) {
          target.health = Math.max(0, (target.health || 100) - damage);
          if (target.health === 0 && attackerId) {
              const attacker = room.players[attackerId];
              if (attacker) {
                  attacker.wins = (attacker.wins || 0) + 1;
              }
          }
      }
      io.to(roomId).emit("remote-player-hit", { targetId, damage, attackerId });
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (rooms[roomId]) {
          const playerName = rooms[roomId].players[socket.id]?.name;
          delete rooms[roomId].players[socket.id];
          
          if (Object.keys(rooms[roomId].players).length === 0) {
            delete rooms[roomId];
          } else {
            io.to(roomId).emit("room-update", rooms[roomId]);
            const systemMsg = {
              id: Date.now().toString(),
              sender: "System",
              text: `${playerName} left the room`,
              timestamp: new Date().toLocaleTimeString()
            };
            rooms[roomId].chat.push(systemMsg);
            io.to(roomId).emit("chat-message", systemMsg);
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
