import * as path from "path";
import express from "express";
import morgan from "morgan";
import createHttpError from "http-errors";
import "./db/database";

import rootRoutes from "./routes/root";
import { testRouter } from "./routes/test";
import gameRoutes from "./routes/game";
import userRoutes from "./routes/user";
import chatRoutes from "./routes/chat";
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';

import session from "express-session";
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { RoomService } from './services/roomService';

const app = express();

const PORT = process.env.PORT || 3000;

const PgStore = connectPgSimple(session);

const pgPool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'crazy_eights',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Configure the session middleware
app.use(session({
  store: new PgStore({
    pool: pgPool,
    tableName: 'session', // Name of your session table
  }),
  secret: 'testtestset', // Replace with a strong, unique secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax',
  },
}));

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use("/test", testRouter);
app.use("/api/game", gameRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/", rootRoutes);

// Create HTTP server and attach socket.io for real-time events
const httpServer = createServer(app);
const io = new IOServer(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});

// Expose io via app.locals for routes to emit events
app.locals.io = io;

io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  socket.on('joinGame', ({ gameId }) => {
    const room = `game:${gameId}`;
    socket.join(room);
    console.log(`socket ${socket.id} joined ${room}`);
  });

  socket.on('leaveGame', ({ gameId }) => {
    const room = `game:${gameId}`;
    socket.leave(room);
    console.log(`socket ${socket.id} left ${room}`);
  });

  socket.on('joinChat', ({ roomId }) => {
    const room = `chat:room:${roomId}`;
    socket.join(room);
    console.log(`socket ${socket.id} joined chat ${room}`);
  });

  socket.on('leaveChat', ({ roomId }) => {
    const room = `chat:room:${roomId}`;
    socket.leave(room);
    console.log(`socket ${socket.id} left chat ${room}`);
  });

  socket.on('lobby:join', async ({ roomId, userId }) => {
    try {
      const room = await RoomService.getRoomById(roomId);
      if (!room) return socket.emit('lobby:error', { message: 'Room not found' });

      if (await RoomService.isRoomFull(room.id)) {
        return socket.emit('lobby:error', { message: 'Room is full' });
      }

      await RoomService.addMember(roomId, userId);
      socket.join(`lobby:${roomId}`);

      const roomWithMembers = await RoomService.getRoomWithMembers(roomId);
      socket.emit('lobby:joined', { room: roomWithMembers });
      io.to(`lobby:${roomId}`).emit('lobby:memberUpdate', { room: roomWithMembers });
    } catch (error: any) {
      socket.emit('lobby:error', { message: error.message });
    }
  });

  socket.on('lobby:joinRoom', ({ roomId }) => {
    socket.join(`lobby:${roomId}`);
    console.log(`socket ${socket.id} joined lobby room ${roomId}`);
  });

  socket.on('lobby:ready', async ({ roomId, userId, isReady }) => {
    try {
      await RoomService.setPlayerReady(roomId, userId, isReady);
      const roomWithMembers = await RoomService.getRoomWithMembers(roomId);

      io.to(`lobby:${roomId}`).emit('lobby:readyUpdate', {
        room: roomWithMembers,
        userId,
        isReady
      });
    } catch (error: any) {
      socket.emit('lobby:error', { message: error.message });
    }
  });

  socket.on('lobby:leave', async ({ roomId, userId }) => {
    try {
      socket.leave(`lobby:${roomId}`);
      await RoomService.removeMember(roomId, userId);

      // Check if room is empty
      const members = await RoomService.getRoomMembers(roomId);
      if (members.length === 0) {
        await RoomService.deleteRoom(roomId);
        io.emit('room:deleted', { roomId });
      }
    } catch (error) {
      console.error('Error leaving lobby:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('socket disconnected:', socket.id);
  });
});



// Error handler
app.use((error: any, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(error.status || 500);
  response.json({
    error: {
      message: error.message,
      status: error.status || 500
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});