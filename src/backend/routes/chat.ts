import express from 'express';
import { db } from '../db/database';

const router = express.Router();

// Get recent messages for a room
router.get('/rooms/:roomId/messages', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (isNaN(roomId)) return res.status(400).json({ error: 'Invalid room id' });

    const result = await db.query(
      `SELECT cm.id, cm.message, cm.sent_at, cm.user_id, u.username
       FROM chat_messages cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.room_id = $1
       ORDER BY cm.sent_at ASC
       LIMIT 200`,
      [roomId]
    );

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Post a message to a room (requires session)
router.post('/rooms/:roomId/messages', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    if (isNaN(roomId)) return res.status(400).json({ error: 'Invalid room id' });

    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { message } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message required' });

    const result = await db.query(
      `INSERT INTO chat_messages (room_id, user_id, message) VALUES ($1, $2, $3) RETURNING id, sent_at`,
      [roomId, userId, message]
    );

    const inserted = result.rows[0];

    // Emit via socket.io if available
    try {
      const io = req.app.locals && req.app.locals.io ? req.app.locals.io : null;
      if (io) {
        io.to(`chat:room:${roomId}`).emit('chat:message', {
          id: inserted.id,
          room_id: roomId,
          user_id: userId,
          username: req.session.username || 'Unknown',
          message,
          sent_at: inserted.sent_at
        });
      }
    } catch (e) {
      console.warn('Failed to emit chat message', e);
    }

    res.json({ success: true, id: inserted.id, sent_at: inserted.sent_at });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
