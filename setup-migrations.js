const fs = require('fs');
const path = require('path');

console.log("Setting up migration system...");

// Create migrations directory
const migrationsDir = path.join(__dirname, 'src', 'backend', 'db', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// Create initial migration
const initialMigration = `-- Users table
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
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_hands_user ON hands(user_id);
`;

fs.writeFileSync(path.join(migrationsDir, '001_initial_schema.sql'), initialMigration);

// Create down migration
const downMigration = `-- Drop tables in reverse order to handle foreign key constraints
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS discard_pile;
DROP TABLE IF EXISTS turn_log;
DROP TABLE IF EXISTS hands;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS users;
`;

fs.writeFileSync(path.join(migrationsDir, '001_initial_schema_down.sql'), downMigration);

console.log("✓ Migration system setup complete!");
console.log("");
console.log("Available commands:");
console.log("  npm run migrate:up    - Apply pending migrations");
console.log("  npm run migrate:down  - Revert the last migration");
console.log("  npm run migrate:status - Check migration status");
console.log("  npm run db:reset      - Reset database completely");
console.log("");
console.log("To create a new migration:");
console.log("  cp src/backend/db/migrations/001_initial_schema.sql src/backend/db/migrations/002_your_migration_name.sql");
console.log("  Then edit the new file with your schema changes");

/*

#!/bin/bash
echo "Setting up migration system..."

# Create migrations directory
mkdir -p src/backend/db/migrations

# Create initial migration
cat > src/backend/db/migrations/001_initial_schema.sql << 'EOF'
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
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_hands_user ON hands(user_id);
EOF

# Create a down migration for the initial schema
cat > src/backend/db/migrations/001_initial_schema_down.sql << 'EOF'
-- Drop tables in reverse order to handle foreign key constraints
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS discard_pile;
DROP TABLE IF EXISTS turn_log;
DROP TABLE IF EXISTS hands;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS users;
EOF

echo "✓ Migration system setup complete!"
echo ""
echo "Available commands:"
echo "  npm run migrate:up    - Apply pending migrations"
echo "  npm run migrate:down  - Revert the last migration"
echo "  npm run db:reset      - Reset database completely"
echo ""
echo "To create a new migration:"
echo "  cp src/backend/db/migrations/001_initial_schema.sql src/backend/db/migrations/002_your_migration_name.sql"
echo "  Then edit the new file with your schema changes"
EOF

chmod +x setup-migrations.sh
*/