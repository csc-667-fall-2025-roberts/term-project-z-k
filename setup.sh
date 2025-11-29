#!/bin/bash

echo "Setting up Crazy Eights project structure..."

# Create directories
echo "Creating directories..."
mkdir -p src/backend/db
mkdir -p src/backend/services
mkdir -p src/backend/types
mkdir -p src/backend/routes
mkdir -p src/backend/middleware
mkdir -p src/backend/views

# Create schema.sql
echo "Creating schema.sql..."
cat > src/backend/db/schema.sql << 'EOF'
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    host_id INTEGER NOT NULL,
    max_players INTEGER DEFAULT 4,
    is_private BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'waiting',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Room Members table
CREATE TABLE IF NOT EXISTS room_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_ready BOOLEAN DEFAULT 0,
    player_order INTEGER,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(room_id, user_id)
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    current_player_id INTEGER,
    direction TEXT DEFAULT 'clockwise',
    top_card TEXT,
    active_suit TEXT,
    deck TEXT,
    status TEXT DEFAULT 'active',
    winner_id INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (current_player_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
);

-- Hands table
CREATE TABLE IF NOT EXISTS hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    cards TEXT NOT NULL,
    card_count INTEGER DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(game_id, user_id)
);

-- Turn Log table
CREATE TABLE IF NOT EXISTS turn_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    card_played TEXT,
    suit_declared TEXT,
    cards_drawn INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Discard Pile table
CREATE TABLE IF NOT EXISTS discard_pile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    card TEXT NOT NULL,
    played_by INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (played_by) REFERENCES users(id)
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_hands_game ON hands(game_id);
CREATE INDEX IF NOT EXISTS idx_turn_log_game ON turn_log(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id);
EOF

# Create database.ts
echo "Creating database.ts..."
cat > src/backend/db/database.ts << 'EOF'
import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = path.join(__dirname, "../../../", "crazy_eights.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  private initialize() {
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    this.db.exec(schema);
    console.log("Database initialized successfully");
  }

  getDb(): Database.Database {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

const dbManager = new DatabaseManager();
export const db = dbManager.getDb();

export default dbManager;
EOF

# Create database types
echo "Creating database.ts types..."
cat > src/backend/types/database.ts << 'EOF'
export interface User {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  created_at: string;
  last_login: string | null;
  wins: number;
  losses: number;
  total_games: number;
}

export interface Room {
  id: number;
  name: string;
  code: string;
  host_id: number;
  max_players: number;
  is_private: boolean;
  status: "waiting" | "in_progress" | "finished";
  created_at: string;
}

export interface RoomMember {
  id: number;
  room_id: number;
  user_id: number;
  joined_at: string;
  is_ready: boolean;
  player_order: number | null;
}

export interface Game {
  id: number;
  room_id: number;
  current_player_id: number | null;
  direction: "clockwise" | "counterclockwise";
  top_card: string | null;
  active_suit: string | null;
  deck: string;
  status: "active" | "finished";
  winner_id: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface Hand {
  id: number;
  game_id: number;
  user_id: number;
  cards: string;
  card_count: number;
}

export interface TurnLog {
  id: number;
  game_id: number;
  user_id: number;
  action: "play_card" | "draw_card" | "declare_suit" | "skip";
  card_played: string | null;
  suit_declared: string | null;
  cards_drawn: number;
  timestamp: string;
}

export interface DiscardPile {
  id: number;
  game_id: number;
  card: string;
  played_by: number;
  played_at: string;
}

export interface ChatMessage {
  id: number;
  room_id: number;
  user_id: number;
  message: string;
  sent_at: string;
}

export interface Card {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
}

export interface RoomWithMembers extends Room {
  members: (RoomMember & { username: string })[];
}

export interface GameState extends Game {
  players: {
    user_id: number;
    username: string;
    card_count: number;
    is_current: boolean;
  }[];
}
EOF

echo "✓ All files created successfully!"
echo ""
echo "Next steps:"
echo "1. Run: npm install better-sqlite3"
echo "2. Run: npm install --save-dev @types/better-sqlite3"
echo "3. Copy the service files (userService.ts, roomService.ts, gameService.ts)"
echo "4. Copy the routes/game.ts file"
echo "5. Update your server.ts to import the database and game routes"
echo "6. Run: npm run start:dev"
EOF

chmod +x setup.sh
echo "Setup script created! Run with: ./setup.sh"