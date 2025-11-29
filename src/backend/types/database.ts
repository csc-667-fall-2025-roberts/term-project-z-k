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
  top_card: string | null; // JSON string
  active_suit: string | null;
  deck: string; // JSON string
  status: "active" | "finished";
  winner_id: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface Hand {
  id: number;
  game_id: number;
  user_id: number;
  cards: string; // JSON string
  card_count: number;
}

export interface TurnLog {
  id: number;
  game_id: number;
  user_id: number;
  action: "play_card" | "draw_card" | "declare_suit" | "skip";
  card_played: string | null; // JSON string
  suit_declared: string | null;
  cards_drawn: number;
  timestamp: string;
}

export interface DiscardPile {
  id: number;
  game_id: number;
  card: string; // JSON string
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

// Card type for game logic
export interface Card {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
}

// Extended types with joined data
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
