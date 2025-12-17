import express from 'express';
import { createServer } from 'http';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import dotenv from 'dotenv';
import path from 'path';
import { db } from './db/database';
import { setupSocket } from './socket';

// Import routes
import rootRouter from './routes/root';
import userRouter from './routes/user';
import gameRouter from './routes/game';
import chatRouter from './routes/chat';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Session configuration
const PgSession = connectPgSimple(session);

const sessionMiddleware = session({
  store: new PgSession({
    pool: db,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
});

app.use(sessionMiddleware);

// Setup Socket.IO with session sharing
const io = setupSocket(httpServer, sessionMiddleware);

// Make io available in routes
app.locals.io = io;

// Routes
app.use('/api/users', userRouter);
app.use('/api/game', gameRouter);
app.use('/api/chat', chatRouter);
app.use('/', rootRouter);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO enabled for real-time communication`);
});

export { io };