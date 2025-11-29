import express from "express";
import { UserService } from "../services/userService";
import { RoomService } from "../services/roomService";
import { GameService } from "../services/gameService";

const router = express.Router();

// Create a new room
router.post("/rooms", (req, res) => {
  try {
    const { name, hostId, maxPlayers, isPrivate } = req.body;
    const room = RoomService.createRoom(name, hostId, maxPlayers, isPrivate);
    
    // Auto-join the host
    RoomService.addMember(room.id, hostId);
    
    res.json(room);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available rooms
router.get("/rooms", (_req, res) => {
  try {
    const rooms = RoomService.getAvailableRooms();
    res.json(rooms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Join a room
router.post("/rooms/:code/join", (req, res) => {
  try {
    const { code } = req.params;
    const { userId } = req.body;
    
    const room = RoomService.getRoomByCode(code);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    
    if (RoomService.isRoomFull(room.id)) {
      return res.status(400).json({ error: "Room is full" });
    }
    
    RoomService.addMember(room.id, userId);
    const roomWithMembers = RoomService.getRoomWithMembers(room.id);
    
    res.json(roomWithMembers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start a game
router.post("/rooms/:roomId/start", (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const members = RoomService.getRoomMembers(roomId);
    
    if (members.length < 2) {
      return res.status(400).json({ error: "Need at least 2 players" });
    }
    
    // Assign player orders
    RoomService.assignPlayerOrders(roomId);
    RoomService.updateRoomStatus(roomId, "in_progress");
    
    // Create game
    const playerIds = members.map(m => m.user_id);
    const game = GameService.createGame(roomId, playerIds);
    
    res.json(game);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get game state
router.get("/games/:gameId", (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    
    if (isNaN(gameId)) {
      return res.status(400).json({ error: "Invalid game ID" });
    }

    const gameState = GameService.getGameState(gameId);
    
    if (!gameState) {
      return res.status(404).json({ error: "Game not found" });
    }
    
    res.json(gameState);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get player's hand
router.get("/games/:gameId/hand/:userId", (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const userId = parseInt(req.params.userId);
    
    const hand = GameService.getHand(gameId, userId);
    
    if (!hand) {
      return res.status(404).json({ error: "Hand not found" });
    }
    
    res.json(JSON.parse(hand.cards));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Play a card
router.post("/games/:gameId/play", (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { userId, card, declaredSuit } = req.body;
    
    const hand = GameService.getHand(gameId, userId);
    if (!hand) {
      return res.status(404).json({ error: "Hand not found" });
    }
    
    const cards = JSON.parse(hand.cards);
    const cardIndex = cards.findIndex(
      (c: any) => c.suit === card.suit && c.rank === card.rank
    );
    
    if (cardIndex === -1) {
      return res.status(400).json({ error: "Card not in hand" });
    }
    
    // Remove card from hand
    cards.splice(cardIndex, 1);
    GameService.updateHand(gameId, userId, cards);
    
    // Play the card
    GameService.playCard(gameId, userId, card, declaredSuit);
    
    // Check for winner
    if (cards.length === 0) {
      GameService.finishGame(gameId, userId);
      UserService.updateStats(userId, true);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Draw a card
router.post("/games/:gameId/draw", (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { userId } = req.body;
    
    const card = GameService.drawCard(gameId, userId);
    
    if (!card) {
      return res.status(400).json({ error: "Deck is empty" });
    }
    
    res.json(card);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get turn history
router.get("/games/:gameId/history", (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const history = GameService.getTurnHistory(gameId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;