-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    host_id INTEGER NOT NULL,
    max_players INTEGER DEFAULT 4,
    is_private BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Room Members table
CREATE TABLE IF NOT EXISTS room_members (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_ready BOOLEAN DEFAULT false,
    player_order INTEGER,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(room_id, user_id)
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    current_player_id INTEGER,
    direction TEXT DEFAULT 'clockwise',
    top_card TEXT,
    active_suit TEXT,
    deck TEXT,
    status TEXT DEFAULT 'active',
    winner_id INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (current_player_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
);

-- Hands table
CREATE TABLE IF NOT EXISTS hands (
    id SERIAL PRIMARY KEY,
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
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    card_played TEXT,
    suit_declared TEXT,
    cards_drawn INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Discard Pile table
CREATE TABLE IF NOT EXISTS discard_pile (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL,
    card TEXT NOT NULL,
    played_by INTEGER NOT NULL,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (played_by) REFERENCES users(id)
);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Migrations table
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_id);
CREATE INDEX IF NOT EXISTS idx_hands_game ON hands(game_id);
CREATE INDEX IF NOT EXISTS idx_turn_log_game ON turn_log(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_hands_user ON hands(user_id);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);