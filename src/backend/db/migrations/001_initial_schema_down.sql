-- Drop tables in reverse order to handle foreign key constraints
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS discard_pile;
DROP TABLE IF EXISTS turn_log;
DROP TABLE IF EXISTS hands;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS users;
