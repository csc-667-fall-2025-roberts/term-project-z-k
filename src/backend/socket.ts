import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import session from 'express-session';
import { db } from './db/database';

export function setupSocket(httpServer: HTTPServer, sessionMiddleware: any) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true
    }
  });

  // Share session with Socket.IO
  io.engine.use(sessionMiddleware);

  io.on('connection', (socket: Socket) => {
    const req = socket.request as any;
    const session = req.session;
    
    if (!session || !session.userId) {
      console.log('Unauthorized socket connection attempt');
      socket.disconnect();
      return;
    }

    const userId = session.userId;
    const username = session.username;
    
    console.log(`User connected: ${username} (${userId})`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Join a chat room
    socket.on('chat:join', async (data: { roomId: number }) => {
      const { roomId } = data;
      
      try {
        // Verify user is a member of this room
        const result = await db.query(
          'SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2',
          [roomId, userId]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }

        socket.join(`chat:room:${roomId}`);
        console.log(`User ${username} joined chat room ${roomId}`);
        
        // Notify others in the room
        socket.to(`chat:room:${roomId}`).emit('chat:user_joined', {
          userId,
          username,
          roomId
        });
      } catch (err) {
        console.error('Error joining chat room:', err);
        socket.emit('error', { message: 'Failed to join chat room' });
      }
    });

    // Leave a chat room
    socket.on('chat:leave', (data: { roomId: number }) => {
      const { roomId } = data;
      socket.leave(`chat:room:${roomId}`);
      
      socket.to(`chat:room:${roomId}`).emit('chat:user_left', {
        userId,
        username,
        roomId
      });
      
      console.log(`User ${username} left chat room ${roomId}`);
    });

    // Send a chat message
    socket.on('chat:send', async (data: { roomId: number; message: string }) => {
      const { roomId, message } = data;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        socket.emit('error', { message: 'Invalid message' });
        return;
      }

      try {
        // Verify user is a member
        const memberCheck = await db.query(
          'SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2',
          [roomId, userId]
        );

        if (memberCheck.rows.length === 0) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }

        // Insert message into database
        const result = await db.query(
          `INSERT INTO chat_messages (room_id, user_id, message) 
           VALUES ($1, $2, $3) 
           RETURNING id, sent_at`,
          [roomId, userId, message.trim()]
        );

        const newMessage = {
          id: result.rows[0].id,
          room_id: roomId,
          user_id: userId,
          username,
          message: message.trim(),
          sent_at: result.rows[0].sent_at
        };

        // Broadcast to all users in the room (including sender)
        io.to(`chat:room:${roomId}`).emit('chat:message', newMessage);
        
      } catch (err) {
        console.error('Error sending message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Join a game room for real-time updates
    socket.on('game:join', async (data: { gameId: number }) => {
      const { gameId } = data;
      
      try {
        // Verify user is in this game
        const result = await db.query(
          `SELECT * FROM hands WHERE game_id = $1 AND user_id = $2`,
          [gameId, userId]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Not a player in this game' });
          return;
        }

        socket.join(`game:${gameId}`);
        console.log(`User ${username} joined game ${gameId}`);
      } catch (err) {
        console.error('Error joining game:', err);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Leave a game room
    socket.on('game:leave', (data: { gameId: number }) => {
      const { gameId } = data;
      socket.leave(`game:${gameId}`);
      console.log(`User ${username} left game ${gameId}`);
    });

    // Join a room lobby
    socket.on('room:join', async (data: { roomId: number }) => {
      const { roomId } = data;
      
      try {
        // Verify user is a member
        const result = await db.query(
          'SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2',
          [roomId, userId]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }

        socket.join(`room:${roomId}`);
        console.log(`User ${username} joined room ${roomId}`);
        
        // Notify others
        socket.to(`room:${roomId}`).emit('room:user_joined', {
          userId,
          username,
          roomId
        });
      } catch (err) {
        console.error('Error joining room:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave a room lobby
    socket.on('room:leave', (data: { roomId: number }) => {
      const { roomId } = data;
      socket.leave(`room:${roomId}`);
      
      socket.to(`room:${roomId}`).emit('room:user_left', {
        userId,
        username,
        roomId
      });
      
      console.log(`User ${username} left room ${roomId}`);
    });

    // Handle typing indicator
    socket.on('chat:typing', (data: { roomId: number; isTyping: boolean }) => {
      const { roomId, isTyping } = data;
      
      socket.to(`chat:room:${roomId}`).emit('chat:user_typing', {
        userId,
        username,
        roomId,
        isTyping
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${username} (${userId})`);
    });
  });

  return io;
}