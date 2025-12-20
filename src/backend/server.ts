import * as path from "path";
import express from "express";
import morgan from "morgan";
import createHttpError from "http-errors";
import "./db/database";
import { initializeDatabase, db } from "./db/database";

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

const app = express();

const PORT = process.env.PORT || 3000;

const PgStore = connectPgSimple(session);

/*
//duplicate pool from before connecting to render
const pgPool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'crazy_eights',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
});
*/

// Configure the session middleware
app.use(session({
  store: new PgStore({
    pool: db as any,
    tableName: 'session', // Name of your session table
  }),
  secret: process.env.SESSION_SECRET || 'testtestset', // Replace with a strong, unique secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
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

  socket.on('disconnect', () => {
    console.log('socket disconnected:', socket.id);
  });
});

// Start server only after database is ready
const startServer = async () => {
  try {
    await initializeDatabase();
    
    httpServer.listen(PORT, () => {
      console.log(`Server started on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

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