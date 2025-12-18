"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const database_1 = require("../db/database");
class RoomService {
    static generateRoomCode() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    static createRoom(name, hostId, maxPlayers = 4, isPrivate = false) {
        let code = this.generateRoomCode();
        // Ensure unique code
        while (this.getRoomByCode(code)) {
            code = this.generateRoomCode();
        }
        const stmt = database_1.db.prepare(`
      INSERT INTO rooms (name, code, host_id, max_players, is_private)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(name, code, hostId, maxPlayers, isPrivate ? 1 : 0);
        return this.getRoomById(result.lastInsertRowid);
    }
    static setPlayerReady(roomId, userId, isReady) {
        const stmt = database_1.db.prepare(`
      UPDATE room_members
      SET is_ready = ?
      WHERE room_id = ? AND user_id = ?
    `);
        const result = stmt.run(isReady ? 1 : 0, roomId, userId);
        // Check if the update actually affected any rows
        if (result.changes === 0) {
            throw new Error(`User ${userId} is not a member of room ${roomId}`);
        }
    }
    static getPlayerReadyStatus(roomId, userId) {
        const stmt = database_1.db.prepare(`
      SELECT is_ready FROM room_members
      WHERE room_id = ? AND user_id = ?
    `);
        const member = stmt.get(roomId, userId);
        if (!member) {
            throw new Error(`User ${userId} is not a member of room ${roomId}`);
        }
        return member.is_ready === 1;
    }
    static areAllPlayersReady(roomId) {
        const stmt = database_1.db.prepare(`
      SELECT COUNT(*) as total, SUM(is_ready) as ready
      FROM room_members
      WHERE room_id = ?
    `);
        const result = stmt.get(roomId);
        // Need at least 2 players and all must be ready
        return result.total >= 2 && result.ready === result.total;
    }
    static getRoomById(id) {
        const stmt = database_1.db.prepare("SELECT * FROM rooms WHERE id = ?");
        const room = stmt.get(id);
        // Convert SQLite integers to booleans
        if (room) {
            room.is_private = Boolean(room.is_private);
        }
        return room;
    }
    static getRoomByCode(code) {
        const stmt = database_1.db.prepare("SELECT * FROM rooms WHERE code = ?");
        const room = stmt.get(code);
        if (room) {
            room.is_private = Boolean(room.is_private);
        }
        return room;
    }
    static getRoomWithMembers(roomId) {
        const room = this.getRoomById(roomId);
        if (!room)
            return undefined;
        const stmt = database_1.db.prepare(`
      SELECT rm.*, u.username
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = ?
      ORDER BY rm.joined_at
    `);
        const members = stmt.all(roomId);
        // Convert is_ready from integer to boolean
        members.forEach(member => {
            member.is_ready = Boolean(member.is_ready);
        });
        return { ...room, members };
    }
    static getAvailableRooms() {
        const stmt = database_1.db.prepare(`
      SELECT r.* FROM rooms r
      WHERE r.status = 'waiting'
      AND r.is_private = 0
      AND (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) < r.max_players
      ORDER BY r.created_at DESC
    `);
        const rooms = stmt.all();
        // Convert is_private from integer to boolean
        rooms.forEach(room => {
            room.is_private = Boolean(room.is_private);
        });
        return rooms;
    }
    static updateRoomStatus(roomId, status) {
        const stmt = database_1.db.prepare("UPDATE rooms SET status = ? WHERE id = ?");
        stmt.run(status, roomId);
    }
    static deleteRoom(roomId) {
        const stmt = database_1.db.prepare("DELETE FROM rooms WHERE id = ?");
        stmt.run(roomId);
    }
    static addMember(roomId, userId) {
        const stmt = database_1.db.prepare(`
      INSERT INTO room_members (room_id, user_id)
      VALUES (?, ?)
    `);
        const result = stmt.run(roomId, userId);
        const getMember = database_1.db.prepare("SELECT * FROM room_members WHERE id = ?");
        const member = getMember.get(result.lastInsertRowid);
        // Convert is_ready from integer to boolean
        member.is_ready = Boolean(member.is_ready);
        return member;
    }
    static removeMember(roomId, userId) {
        const stmt = database_1.db.prepare(`
      DELETE FROM room_members
      WHERE room_id = ? AND user_id = ?
    `);
        stmt.run(roomId, userId);
    }
    static assignPlayerOrders(roomId) {
        const members = database_1.db.prepare(`
      SELECT id FROM room_members WHERE room_id = ? ORDER BY joined_at
    `).all(roomId);
        const stmt = database_1.db.prepare(`
      UPDATE room_members SET player_order = ? WHERE id = ?
    `);
        members.forEach((member, index) => {
            stmt.run(index, member.id);
        });
    }
    static getRoomMembers(roomId) {
        const stmt = database_1.db.prepare("SELECT * FROM room_members WHERE room_id = ?");
        const members = stmt.all(roomId);
        // Convert is_ready from integer to boolean
        members.forEach(member => {
            member.is_ready = Boolean(member.is_ready);
        });
        return members;
    }
    static isRoomFull(roomId) {
        const room = this.getRoomById(roomId);
        if (!room)
            return true;
        const members = this.getRoomMembers(roomId);
        return members.length >= room.max_players;
    }
}
exports.RoomService = RoomService;
