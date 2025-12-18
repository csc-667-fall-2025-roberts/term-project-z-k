"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userService_1 = require("../services/userService");
const roomService_1 = require("../services/roomService");
const gameService_1 = require("../services/gameService");
const router = express_1.default.Router();
// Create a new room
router.post('/rooms', async (req, res) => {
    try {
        const { name, maxPlayers, isPrivate } = req.body;
        const hostId = Number(req.session.userId);
        const room = await roomService_1.RoomService.createRoom(name, hostId, maxPlayers, isPrivate);
        // Auto-join the host
        await roomService_1.RoomService.addMember(room.id, hostId);
        res.status(201).json(room);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get available rooms
router.get('/rooms', async (_req, res) => {
    try {
        const rooms = await roomService_1.RoomService.getAvailableRooms();
        res.json(rooms);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get public rooms (waiting + in_progress) and include player counts and whether
// the current session user has already joined each room
router.get('/rooms/all', async (req, res) => {
    try {
        const userId = Number(req.session?.userId) || 0;
        const result = await (await Promise.resolve().then(() => __importStar(require('../db/database')))).db.query(`SELECT r.*, 
         (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) AS player_count,
         (SELECT COUNT(*) FROM room_members WHERE room_id = r.id AND user_id = $1) > 0 AS joined,
         COALESCE((SELECT is_ready FROM room_members WHERE room_id = r.id AND user_id = $1), false) AS user_ready
       FROM rooms r
       WHERE r.is_private = false
         AND r.status IN ('waiting', 'in_progress')
       ORDER BY CASE WHEN r.status = 'waiting' THEN 0 ELSE 1 END, r.created_at DESC`, [userId]);
        res.json(result.rows);
    }
    catch (error) {
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
        const room = await roomService_1.RoomService.getRoomWithMembers(roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json(room);
    }
    catch (error) {
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
        const room = await roomService_1.RoomService.getRoomByCode(code);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        if (await roomService_1.RoomService.isRoomFull(room.id)) {
            return res.status(400).json({ error: 'Room is full' });
        }
        await roomService_1.RoomService.addMember(room.id, userId);
        const roomWithMembers = await roomService_1.RoomService.getRoomWithMembers(room.id);
        res.json(roomWithMembers);
    }
    catch (error) {
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
        await roomService_1.RoomService.setPlayerReady(roomId, userId, isReady);
        // Check if all players are ready
        const allReady = await roomService_1.RoomService.areAllPlayersReady(roomId);
        res.json({
            success: true,
            isReady,
            allPlayersReady: allReady
        });
    }
    catch (error) {
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
        const isReady = await roomService_1.RoomService.getPlayerReadyStatus(roomId, userId);
        res.json({ isReady });
    }
    catch (error) {
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
        await roomService_1.RoomService.removeMember(roomId, userId);
        // Check if room is empty, delete it if so
        const members = await roomService_1.RoomService.getRoomMembers(roomId);
        if (members.length === 0) {
            await roomService_1.RoomService.deleteRoom(roomId);
            return res.json({ success: true, roomDeleted: true });
        }
        res.json({ success: true, roomDeleted: false });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete a room (host only)
router.delete('/rooms/:roomId', async (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const userId = Number(req.session.userId);
        if (isNaN(roomId)) {
            return res.status(400).json({ error: 'Invalid room ID' });
        }
        const room = await roomService_1.RoomService.getRoomById(roomId);
        if (!room)
            return res.status(404).json({ error: 'Room not found' });
        // Only host can delete
        if (Number(room.host_id) !== Number(userId)) {
            return res.status(403).json({ error: 'Only the host may delete the room' });
        }
        await roomService_1.RoomService.deleteRoom(roomId);
        // Notify via socket if available
        try {
            const io = (req.app.locals && req.app.locals.io) ? req.app.locals.io : null;
            if (io) {
                io.to(`room:${roomId}`).emit('room:deleted', { roomId });
            }
        }
        catch (e) {
            console.warn('Failed to emit room:deleted', e);
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Host-only: change room status (e.g., waiting <-> in_progress)
router.patch('/rooms/:roomId/status', async (req, res) => {
    try {
        const roomId = parseInt(req.params.roomId);
        const { status } = req.body;
        const userId = Number(req.session.userId);
        if (isNaN(roomId))
            return res.status(400).json({ error: 'Invalid room ID' });
        if (!status || (status !== 'waiting' && status !== 'in_progress')) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const room = await roomService_1.RoomService.getRoomById(roomId);
        if (!room)
            return res.status(404).json({ error: 'Room not found' });
        if (Number(room.host_id) !== Number(userId)) {
            return res.status(403).json({ error: 'Only the host may change room status' });
        }
        await roomService_1.RoomService.updateRoomStatus(roomId, status);
        // Notify via socket if available
        try {
            const io = (req.app.locals && req.app.locals.io) ? req.app.locals.io : null;
            if (io) {
                io.emit('room:statusChanged', { roomId, status });
            }
        }
        catch (e) {
            console.warn('Failed to emit room:statusChanged', e);
        }
        res.json({ success: true, status });
    }
    catch (error) {
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
        const members = await roomService_1.RoomService.getRoomMembers(roomId);
        if (members.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 players' });
        }
        // Check if all players are ready
        if (!(await roomService_1.RoomService.areAllPlayersReady(roomId))) {
            return res.status(400).json({ error: 'All players must be ready' });
        }
        // Assign player orders
        await roomService_1.RoomService.assignPlayerOrders(roomId);
        await roomService_1.RoomService.updateRoomStatus(roomId, 'in_progress');
        // Create game
        const playerIds = members.map(m => m.user_id);
        const game = await gameService_1.GameService.createGame(roomId, playerIds);
        // Emit game started to room
        try {
            const io = (req.app.locals && req.app.locals.io) ? req.app.locals.io : null;
            if (io) {
                // Emit to both the new game-id channel and the pre-start room channel (roomId)
                io.to(`game:${game.id}`).emit('game:started', { gameId: game.id });
                io.to(`game:${roomId}`).emit('game:started', { gameId: game.id });
            }
        }
        catch (e) {
            console.warn('Failed to emit game:started', e);
        }
        res.json(game);
    }
    catch (error) {
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
        const gameState = await gameService_1.GameService.getGameState(gameId);
        if (!gameState) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json(gameState);
    }
    catch (error) {
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
        const hand = await gameService_1.GameService.getHand(gameId, userId);
        if (!hand) {
            return res.status(404).json({ error: 'Hand not found' });
        }
        res.json(JSON.parse(hand.cards));
    }
    catch (error) {
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
        const game = await gameService_1.GameService.getGameById(gameId);
        if (!game)
            return res.status(404).json({ error: 'Game not found' });
        // Only current player may play
        if (Number(game.current_player_id) !== Number(userId)) {
            return res.status(400).json({ error: 'Not your turn' });
        }
        const hand = await gameService_1.GameService.getHand(gameId, userId);
        if (!hand) {
            return res.status(404).json({ error: 'Hand not found' });
        }
        const cards = JSON.parse(hand.cards);
        const cardIndex = cards.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
        if (cardIndex === -1) {
            return res.status(400).json({ error: 'Card not in hand' });
        }
        // Validate legality of play
        const gameTop = JSON.parse(game.top_card);
        const activeSuit = game.active_suit;
        const playable = (card.rank === '8') || (card.suit === activeSuit) || (card.rank === gameTop.rank);
        if (!playable) {
            return res.status(400).json({ error: 'Illegal play' });
        }
        // If playing an 8, require declaredSuit
        if (card.rank === '8') {
            const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
            if (!declaredSuit || !suits.includes(declaredSuit)) {
                return res.status(400).json({ error: 'Must declare a valid suit when playing an 8' });
            }
        }
        // Remove card from hand and update
        cards.splice(cardIndex, 1);
        await gameService_1.GameService.updateHand(gameId, userId, cards);
        // Play the card (persist top and discard)
        await gameService_1.GameService.playCard(gameId, userId, card, declaredSuit);
        // Handle special card effects
        // 2 -> next player draws 2 and is skipped
        // J -> skip next player
        // Q -> reverse direction
        // 8 -> suit change (already handled)
        try {
            if (card.rank === '2') {
                // victim draws 2
                const victimId = await gameService_1.GameService.getNextPlayerId(gameId, 1);
                await gameService_1.GameService.drawCard(gameId, victimId);
                await gameService_1.GameService.drawCard(gameId, victimId);
                // skip victim
                await gameService_1.GameService.advanceTurn(gameId, 2);
            }
            else if (card.rank === 'J') {
                // skip next player
                await gameService_1.GameService.advanceTurn(gameId, 2);
            }
            else if (card.rank === 'Q') {
                // reverse direction, then next player is the previous one
                await gameService_1.GameService.reverseDirection(gameId);
                await gameService_1.GameService.advanceTurn(gameId, 1);
            }
            else {
                // normal advance
                await gameService_1.GameService.advanceTurn(gameId, 1);
            }
            // Check for winner
            if (cards.length === 0) {
                await gameService_1.GameService.finishGame(gameId, userId);
                await userService_1.UserService.updateStats(userId, true);
            }
            const io = (req.app.locals && req.app.locals.io) ? req.app.locals.io : null;
            if (io) {
                const state = await gameService_1.GameService.getGameState(gameId);
                const hand = await gameService_1.GameService.getHand(gameId, userId);
                io.to(`game:${gameId}`).emit('game:update', { gameId, state, userId, hand: hand ? JSON.parse(hand.cards) : [] });
            }
        }
        catch (e) {
            console.warn('Failed to process special card effects or emit update', e);
        }
        res.json({ success: true });
    }
    catch (error) {
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
        const game = await gameService_1.GameService.getGameById(gameId);
        if (!game)
            return res.status(404).json({ error: 'Game not found' });
        // Only current player may draw
        if (Number(game.current_player_id) !== Number(userId)) {
            return res.status(400).json({ error: 'Not your turn' });
        }
        // Attempt to draw; if deck empty try to replenish from discard
        let card = await gameService_1.GameService.drawCard(gameId, userId);
        if (!card) {
            const replenished = await gameService_1.GameService.replenishDeckFromDiscard(gameId);
            if (replenished) {
                card = await gameService_1.GameService.drawCard(gameId, userId);
            }
        }
        if (!card) {
            return res.status(400).json({ error: 'Deck is empty' });
        }
        // After drawing, end turn
        try {
            await gameService_1.GameService.advanceTurn(gameId, 1);
        }
        catch (e) {
            console.warn('Failed to advance turn after draw', e);
        }
        // Emit update to room
        try {
            const io = (req.app.locals && req.app.locals.io) ? req.app.locals.io : null;
            if (io) {
                const state = await gameService_1.GameService.getGameState(gameId);
                const hand = await gameService_1.GameService.getHand(gameId, userId);
                io.to(`game:${gameId}`).emit('game:update', { gameId, state, userId, hand: hand ? JSON.parse(hand.cards) : [] });
            }
        }
        catch (e) {
            console.warn('Failed to emit game:update', e);
        }
        res.json(card);
    }
    catch (error) {
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
        const history = await gameService_1.GameService.getTurnHistory(gameId);
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
