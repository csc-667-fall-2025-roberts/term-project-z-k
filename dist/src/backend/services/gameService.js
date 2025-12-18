"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const database_1 = require("../db/database");
class GameService {
    static createDeck() {
        const suits = ["hearts", "diamonds", "clubs", "spades"];
        const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
        const deck = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push({ suit, rank });
            }
        }
        return this.shuffleDeck(deck);
    }
    static shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    static async createGame(roomId, playerIds) {
        const client = await database_1.db.connect();
        try {
            await client.query('BEGIN');
            let deck = this.createDeck();
            // Validate we have enough cards
            const totalCardsNeeded = 5 * playerIds.length + 1;
            if (deck.length < totalCardsNeeded) {
                throw new Error(`Not enough cards in deck. Need ${totalCardsNeeded}, have ${deck.length}`);
            }
            // Deal 5 cards to each player
            const hands = new Map();
            playerIds.forEach(id => hands.set(id, []));
            for (let i = 0; i < 5; i++) {
                for (const playerId of playerIds) {
                    hands.get(playerId).push(deck.pop());
                }
            }
            // Get starting card (not an 8)
            let topCard;
            let attempts = 0;
            const MAX_ATTEMPTS = 10;
            do {
                if (deck.length === 0) {
                    throw new Error("No cards left in deck to find starting card");
                }
                if (attempts >= MAX_ATTEMPTS) {
                    throw new Error("Could not find a non-8 starting card after multiple attempts");
                }
                topCard = deck.pop();
                attempts++;
            } while (topCard.rank === "8");
            // Create the game record
            const gameResult = await client.query(`INSERT INTO games (room_id, current_player_id, direction, top_card, active_suit, deck, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         RETURNING *`, [roomId, playerIds[0], "clockwise", JSON.stringify(topCard), topCard.suit, JSON.stringify(deck)]);
            const game = gameResult.rows[0];
            // Create hands for each player
            for (const [playerId, cards] of hands.entries()) {
                await client.query(`INSERT INTO hands (game_id, user_id, cards, card_count)
           VALUES ($1, $2, $3, $4)`, [game.id, playerId, JSON.stringify(cards), cards.length]);
            }
            // Log game start
            await client.query(`INSERT INTO turn_log (game_id, user_id, action, card_played)
         VALUES ($1, $2, $3, $4)`, [game.id, playerIds[0], "play_card", JSON.stringify(topCard)]);
            await client.query('COMMIT');
            return game;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async getGameById(id) {
        const result = await database_1.db.query('SELECT * FROM games WHERE id = $1', [id]);
        return result.rows[0];
    }
    static async getActiveGameByRoom(roomId) {
        const result = await database_1.db.query(`SELECT * FROM games WHERE room_id = $1 AND status = 'active'`, [roomId]);
        return result.rows[0];
    }
    static async getHand(gameId, userId) {
        const result = await database_1.db.query(`SELECT * FROM hands WHERE game_id = $1 AND user_id = $2`, [gameId, userId]);
        return result.rows[0];
    }
    static async updateHand(gameId, userId, cards) {
        await database_1.db.query(`UPDATE hands
       SET cards = $1, card_count = $2
       WHERE game_id = $3 AND user_id = $4`, [JSON.stringify(cards), cards.length, gameId, userId]);
    }
    static async playCard(gameId, userId, card, declaredSuit) {
        const client = await database_1.db.connect();
        try {
            await client.query('BEGIN');
            // Update top card and active suit
            await client.query(`UPDATE games
         SET top_card = $1, active_suit = $2
         WHERE id = $3`, [JSON.stringify(card), declaredSuit || card.suit, gameId]);
            // Log the turn
            await client.query(`INSERT INTO turn_log (game_id, user_id, action, card_played, suit_declared)
         VALUES ($1, $2, $3, $4, $5)`, [gameId, userId, "play_card", JSON.stringify(card), declaredSuit || null]);
            // Add to discard pile
            await client.query(`INSERT INTO discard_pile (game_id, card, played_by)
         VALUES ($1, $2, $3)`, [gameId, JSON.stringify(card), userId]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get ordered player id list for the game based on room member player_order
     */
    static async getPlayerOrderList(gameId) {
        const game = await this.getGameById(gameId);
        if (!game)
            throw new Error('Game not found');
        const result = await database_1.db.query(`SELECT rm.user_id FROM room_members rm
       WHERE rm.room_id = $1
       ORDER BY rm.player_order ASC NULLS LAST, rm.joined_at ASC`, [game.room_id]);
        return result.rows.map((r) => r.user_id);
    }
    static async getNextPlayerId(gameId, steps = 1) {
        const game = await this.getGameById(gameId);
        if (!game)
            throw new Error('Game not found');
        const order = await this.getPlayerOrderList(gameId);
        if (order.length === 0)
            throw new Error('No players in game');
        const currentIndex = order.findIndex(id => id === game.current_player_id);
        if (currentIndex === -1)
            throw new Error('Current player not found in order');
        const dir = game.direction === 'clockwise' ? 1 : -1;
        const nextIndex = (currentIndex + dir * steps + order.length) % order.length;
        return order[nextIndex];
    }
    static async advanceTurn(gameId, steps = 1) {
        const nextId = await this.getNextPlayerId(gameId, steps);
        await this.setNextPlayer(gameId, nextId);
    }
    /**
     * Replenish the deck from the discard pile (keep top card as game's top card).
     * Returns true if replenished, false otherwise.
     */
    static async replenishDeckFromDiscard(gameId) {
        const client = await database_1.db.connect();
        try {
            await client.query('BEGIN');
            const discardResult = await client.query(`SELECT id, card FROM discard_pile WHERE game_id = $1 ORDER BY played_at ASC`, [gameId]);
            const discards = discardResult.rows;
            if (discards.length <= 1) {
                await client.query('ROLLBACK');
                return false; // nothing to replenish from
            }
            // Keep the last played card as top card
            const top = discards[discards.length - 1];
            const shufflePool = discards.slice(0, -1).map(d => JSON.parse(d.card));
            // Shuffle
            for (let i = shufflePool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shufflePool[i], shufflePool[j]] = [shufflePool[j], shufflePool[i]];
            }
            // Update games.deck with new deck
            await client.query('UPDATE games SET deck = $1 WHERE id = $2', [JSON.stringify(shufflePool), gameId]);
            // Remove all those moved cards from discard_pile
            const idsToRemove = discards.slice(0, -1).map(d => d.id);
            if (idsToRemove.length > 0) {
                await client.query(`DELETE FROM discard_pile WHERE id = ANY($1::int[])`, [idsToRemove]);
            }
            await client.query('COMMIT');
            return true;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async drawCard(gameId, userId) {
        const client = await database_1.db.connect();
        try {
            await client.query('BEGIN');
            const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
            const game = gameResult.rows[0];
            if (!game)
                throw new Error("Game not found");
            const deck = JSON.parse(game.deck);
            if (deck.length === 0) {
                await client.query('ROLLBACK');
                return null;
            }
            const card = deck.pop();
            // Update deck
            await client.query('UPDATE games SET deck = $1 WHERE id = $2', [JSON.stringify(deck), gameId]);
            // Update hand
            const handResult = await client.query('SELECT * FROM hands WHERE game_id = $1 AND user_id = $2', [gameId, userId]);
            const hand = handResult.rows[0];
            if (hand) {
                const cards = JSON.parse(hand.cards);
                cards.push(card);
                await client.query('UPDATE hands SET cards = $1, card_count = $2 WHERE game_id = $3 AND user_id = $4', [JSON.stringify(cards), cards.length, gameId, userId]);
            }
            else {
                throw new Error("Hand not found for user");
            }
            // Log the turn
            await client.query(`INSERT INTO turn_log (game_id, user_id, action, cards_drawn)
         VALUES ($1, $2, $3, $4)`, [gameId, userId, "draw_card", 1]);
            await client.query('COMMIT');
            return card;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async setNextPlayer(gameId, nextPlayerId) {
        await database_1.db.query(`UPDATE games SET current_player_id = $1 WHERE id = $2`, [nextPlayerId, gameId]);
    }
    static async reverseDirection(gameId) {
        const game = await this.getGameById(gameId);
        if (!game)
            return;
        const newDirection = game.direction === "clockwise" ? "counterclockwise" : "clockwise";
        await database_1.db.query(`UPDATE games SET direction = $1 WHERE id = $2`, [newDirection, gameId]);
    }
    static async finishGame(gameId, winnerId) {
        await database_1.db.query(`UPDATE games
       SET status = 'finished', winner_id = $1, finished_at = CURRENT_TIMESTAMP
       WHERE id = $2`, [winnerId, gameId]);
    }
    static async getGameState(gameId) {
        const game = await this.getGameById(gameId);
        if (!game)
            return undefined;
        const result = await database_1.db.query(`SELECT 
         h.user_id,
         u.username,
         h.card_count,
         CASE WHEN g.current_player_id = h.user_id THEN true ELSE false END as is_current
       FROM hands h
       JOIN users u ON h.user_id = u.id
       JOIN games g ON h.game_id = g.id
       WHERE h.game_id = $1
       ORDER BY h.user_id`, [gameId]);
        const players = result.rows;
        return { ...game, players };
    }
    static async getTurnHistory(gameId) {
        const result = await database_1.db.query(`SELECT * FROM turn_log WHERE game_id = $1 ORDER BY timestamp ASC`, [gameId]);
        return result.rows;
    }
}
exports.GameService = GameService;
