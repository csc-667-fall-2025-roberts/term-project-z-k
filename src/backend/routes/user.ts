import express from 'express';
import { UserService } from '../services/userService';
import { RoomService } from '../services/roomService';
import { GameService } from '../services/gameService';

const router = express.Router();

// Create a new room
router.post('/rooms', async (req, res) => {
  try {
    const { name, hostId, maxPlayers, isPrivate } = req.body;
    const room = await RoomService.createRoom(name, hostId, maxPlayers, isPrivate);
    
    // Auto-join the host
    await RoomService.addMember(room.id, hostId);
    
    res.json(room);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available rooms
router.get('/rooms', async (_req, res) => {
  try {
    const rooms = await RoomService.getAvailableRooms();
    res.json(rooms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific room with members
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const room = await RoomService.getRoomWithMembers(roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json(room);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Join a room by code
router.post('/rooms/:code/join', async (req, res) => {
  try {
    const { code } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const room = await RoomService.getRoomByCode(code);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (await RoomService.isRoomFull(room.id)) {
      return res.status(400).json({ error: 'Room is full' });
    }
    
    await RoomService.addMember(room.id, userId);
    const roomWithMembers = await RoomService.getRoomWithMembers(room.id);
    
    res.json(roomWithMembers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set player ready status
router.post('/rooms/:roomId/ready', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { userId, isReady } = req.body;
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    if (userId === undefined) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (isReady === undefined) {
      return res.status(400).json({ error: 'isReady status is required' });
    }
    
    await RoomService.setPlayerReady(roomId, userId, isReady);
    
    // Check if all players are ready
    const allReady = await RoomService.areAllPlayersReady(roomId);
    
    res.json({ 
      success: true, 
      isReady,
      allPlayersReady: allReady
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get player ready status
router.get('/rooms/:roomId/ready/:userId', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const userId = parseInt(req.params.userId);
    
    if (isNaN(roomId) || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid room or user ID' });
    }
    
    const isReady = await RoomService.getPlayerReadyStatus(roomId, userId);
    
    res.json({ isReady });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Leave a room
router.post('/rooms/:roomId/leave', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { userId } = req.body;
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    await RoomService.removeMember(roomId, userId);
    
    // Check if room is empty, delete it if so
    const members = await RoomService.getRoomMembers(roomId);
    if (members.length === 0) {
      await RoomService.deleteRoom(roomId);
      return res.json({ success: true, roomDeleted: true });
    }
    
    res.json({ success: true, roomDeleted: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start a game
router.post('/rooms/:roomId/start', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    
    if (isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    const members = await RoomService.getRoomMembers(roomId);
    
    if (members.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players' });
    }
    
    // Check if all players are ready
    if (!(await RoomService.areAllPlayersReady(roomId))) {
      return res.status(400).json({ error: 'All players must be ready' });
    }
    
    // Assign player orders
    await RoomService.assignPlayerOrders(roomId);
    await RoomService.updateRoomStatus(roomId, 'in_progress');
    
    // Create game
    const playerIds = members.map(m => m.user_id);
    const game = await GameService.createGame(roomId, playerIds);
    
    res.json(game);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get game state
router.get('/games/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }

    const gameState = await GameService.getGameState(gameId);
    
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(gameState);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get player's hand
router.get('/games/:gameId/hand/:userId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const userId = parseInt(req.params.userId);
    
    if (isNaN(gameId) || isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid game or user ID' });
    }
    
    const hand = await GameService.getHand(gameId, userId);
    
    if (!hand) {
      return res.status(404).json({ error: 'Hand not found' });
    }
    
    res.json(JSON.parse(hand.cards));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Play a card
router.post('/games/:gameId/play', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { userId, card, declaredSuit } = req.body;
    
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }
    
    const hand = await GameService.getHand(gameId, userId);
    if (!hand) {
      return res.status(404).json({ error: 'Hand not found' });
    }
    
    const cards = JSON.parse(hand.cards);
    const cardIndex = cards.findIndex(
      (c: any) => c.suit === card.suit && c.rank === card.rank
    );
    
    if (cardIndex === -1) {
      return res.status(400).json({ error: 'Card not in hand' });
    }
    
    // Remove card from hand
    cards.splice(cardIndex, 1);
    await GameService.updateHand(gameId, userId, cards);
    
    // Play the card
    await GameService.playCard(gameId, userId, card, declaredSuit);
    
    // Check for winner
    if (cards.length === 0) {
      await GameService.finishGame(gameId, userId);
      await UserService.updateStats(userId, true);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Draw a card
router.post('/games/:gameId/draw', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { userId } = req.body;
    
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }
    
    const card = await GameService.drawCard(gameId, userId);
    
    if (!card) {
      return res.status(400).json({ error: 'Deck is empty' });
    }
    
    res.json(card);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get turn history
router.get('/games/:gameId/history', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    if (isNaN(gameId)) {
      return res.status(400).json({ error: 'Invalid game ID' });
    }
    
    const history = await GameService.getTurnHistory(gameId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;