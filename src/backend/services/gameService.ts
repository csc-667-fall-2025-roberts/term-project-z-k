import { db } from "../db/database";
import { Game, Hand, TurnLog, Card, GameState } from "../types/database";

export class GameService {
  static createDeck(): Card[] {
    const suits: Card["suit"][] = ["hearts", "diamonds", "clubs", "spades"];
    const ranks: Card["rank"][] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const deck: Card[] = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank });
      }
    }

    return this.shuffleDeck(deck);
  }

  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static createGame(roomId: number, playerIds: number[]): Game {
    let deck = this.createDeck();
    
    // Deal 5 cards to each player
    const hands: Map<number, Card[]> = new Map();
    playerIds.forEach(id => hands.set(id, []));

    for (let i = 0; i < 5; i++) {
      for (const playerId of playerIds) {
        if (deck.length === 0) {
        throw new Error("Somehow, there's no cards in the deck");
      }
        hands.get(playerId)!.push(deck.pop()!);
      }
    }

    // Get starting card (not an 8)
    let topCard: Card;
    do {
      topCard = deck.pop()!;
    } while (topCard.rank === "8");

    const stmt = db.prepare(`
        INSERT INTO games (room_id, current_player_id, direction, top_card, active_suit, deck, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = stmt.run(
      roomId,
      playerIds[0],
      "clockwise",
      JSON.stringify(topCard),
      topCard.suit,
      JSON.stringify(deck)
    );

    const gameId = result.lastInsertRowid as number;

    // Create hands for each player
    for (const [playerId, cards] of hands.entries()) {
      this.createHand(gameId, playerId, cards);
    }

    return this.getGameById(gameId)!;
  }

  static createHand(gameId: number, userId: number, cards: Card[]): Hand {
    const stmt = db.prepare(`
      INSERT INTO hands (game_id, user_id, cards, card_count)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(gameId, userId, JSON.stringify(cards), cards.length);
    
    const getHand = db.prepare("SELECT * FROM hands WHERE id = ?");
    return getHand.get(result.lastInsertRowid) as Hand;
  }

  static getGameById(id: number): Game | undefined {
    const stmt = db.prepare("SELECT * FROM games WHERE id = ?");
    return stmt.get(id) as Game | undefined;
  }

  static getActiveGameByRoom(roomId: number): Game | undefined {
    const stmt = db.prepare(`
      SELECT * FROM games WHERE room_id = ? AND status = 'active'
    `);
    return stmt.get(roomId) as Game | undefined;
  }

  static getHand(gameId: number, userId: number): Hand | undefined {
    const stmt = db.prepare(`
      SELECT * FROM hands WHERE game_id = ? AND user_id = ?
    `);
    return stmt.get(gameId, userId) as Hand | undefined;
  }

  static updateHand(gameId: number, userId: number, cards: Card[]): void {
    const stmt = db.prepare(`
      UPDATE hands
      SET cards = ?, card_count = ?
      WHERE game_id = ? AND user_id = ?
    `);
    stmt.run(JSON.stringify(cards), cards.length, gameId, userId);
  }

  static playCard(gameId: number, userId: number, card: Card, declaredSuit?: string): void {
    const game = this.getGameById(gameId);
    if (!game) throw new Error("Game not found");

    // Update top card and active suit
    const updateGame = db.prepare(`
      UPDATE games
      SET top_card = ?, active_suit = ?
      WHERE id = ?
    `);
    updateGame.run(
      JSON.stringify(card),
      declaredSuit || card.suit,
      gameId
    );

    // Log the turn
    this.logTurn(gameId, userId, "play_card", card, declaredSuit);

    // Add to discard pile
    const addDiscard = db.prepare(`
      INSERT INTO discard_pile (game_id, card, played_by)
      VALUES (?, ?, ?)
    `);
    addDiscard.run(gameId, JSON.stringify(card), userId);
  }

  static drawCard(gameId: number, userId: number): Card | null {
    const game = this.getGameById(gameId);
    if (!game) throw new Error("Game not found");

    const deck: Card[] = JSON.parse(game.deck);
    if (deck.length === 0) return null;

    const card = deck.pop()!;

    // Update deck
    const updateDeck = db.prepare("UPDATE games SET deck = ? WHERE id = ?");
    updateDeck.run(JSON.stringify(deck), gameId);

    // Update hand
    const hand = this.getHand(gameId, userId);
    if (hand) {
      const cards: Card[] = JSON.parse(hand.cards);
      cards.push(card);
      this.updateHand(gameId, userId, cards);
    }

    // Log the turn
    this.logTurn(gameId, userId, "draw_card", null, null, 1);

    return card;
  }

  static logTurn(
    gameId: number,
    userId: number,
    action: TurnLog["action"],
    cardPlayed: Card | null = null,
    suitDeclared: string | null = null,
    cardsDrawn = 0
  ): void {
    const stmt = db.prepare(`
      INSERT INTO turn_log (game_id, user_id, action, card_played, suit_declared, cards_drawn)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      gameId,
      userId,
      action,
      cardPlayed ? JSON.stringify(cardPlayed) : null,
      suitDeclared,
      cardsDrawn
    );
  }

  static setNextPlayer(gameId: number, nextPlayerId: number): void {
    const stmt = db.prepare(`
      UPDATE games SET current_player_id = ? WHERE id = ?
    `);
    stmt.run(nextPlayerId, gameId);
  }

  static reverseDirection(gameId: number): void {
    const game = this.getGameById(gameId);
    if (!game) return;

    const newDirection = game.direction === "clockwise" ? "counterclockwise" : "clockwise";
    const stmt = db.prepare(`
      UPDATE games SET direction = ? WHERE id = ?
    `);
    stmt.run(newDirection, gameId);
  }

  static finishGame(gameId: number, winnerId: number): void {
    const stmt = db.prepare(`
      UPDATE games
      SET status = 'finished', winner_id = ?, finished_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(winnerId, gameId);
  }

  static getGameState(gameId: number): GameState | undefined {
    const game = this.getGameById(gameId);
    if (!game) return undefined;

    const stmt = db.prepare(`
      SELECT 
        h.user_id,
        u.username,
        h.card_count,
        CASE WHEN g.current_player_id = h.user_id THEN 1 ELSE 0 END as is_current
      FROM hands h
      JOIN users u ON h.user_id = u.id
      JOIN games g ON h.game_id = g.id
      WHERE h.game_id = ?
      ORDER BY h.user_id
    `);

    const players = stmt.all(gameId) as GameState["players"];
    return { ...game, players };
  }

  static getTurnHistory(gameId: number): TurnLog[] {
    const stmt = db.prepare(`
      SELECT * FROM turn_log WHERE game_id = ? ORDER BY timestamp ASC
    `);
    return stmt.all(gameId) as TurnLog[];
  }
}