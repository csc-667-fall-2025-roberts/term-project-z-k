import { db } from "../db/database";
import { Room, RoomMember, RoomWithMembers } from "../types/database";

export class RoomService {
  static generateRoomCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  static createRoom(name: string, hostId: number, maxPlayers = 4, isPrivate = false): Room {
    let code = this.generateRoomCode();
    
    // Ensure unique code
    while (this.getRoomByCode(code)) {
      code = this.generateRoomCode();
    }

    const stmt = db.prepare(`
      INSERT INTO rooms (name, code, host_id, max_players, is_private)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(name, code, hostId, maxPlayers, isPrivate ? 1 : 0);
    return this.getRoomById(result.lastInsertRowid as number)!;
  }
  
  static setPlayerReady(roomId: number, userId: number, isReady: boolean): void {
    const stmt = db.prepare(`
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

  static getPlayerReadyStatus(roomId: number, userId: number): boolean {
    const stmt = db.prepare(`
      SELECT is_ready FROM room_members
      WHERE room_id = ? AND user_id = ?
    `);
    
    const member = stmt.get(roomId, userId) as { is_ready: number } | undefined;
    
    if (!member) {
      throw new Error(`User ${userId} is not a member of room ${roomId}`);
    }
    
    return member.is_ready === 1;
  }

  static areAllPlayersReady(roomId: number): boolean {
    const stmt = db.prepare(`
      SELECT COUNT(*) as total, SUM(is_ready) as ready
      FROM room_members
      WHERE room_id = ?
    `);
    
    const result = stmt.get(roomId) as { total: number; ready: number | null };
    
    // Need at least 2 players and all must be ready
    return result.total >= 2 && result.ready === result.total;
  }

  static getRoomById(id: number): Room | undefined {
    const stmt = db.prepare("SELECT * FROM rooms WHERE id = ?");
    const room = stmt.get(id) as Room | undefined;
    
    // Convert SQLite integers to booleans
    if (room) {
      room.is_private = Boolean(room.is_private);
    }
    
    return room;
  }

  static getRoomByCode(code: string): Room | undefined {
    const stmt = db.prepare("SELECT * FROM rooms WHERE code = ?");
    const room = stmt.get(code) as Room | undefined;
    
    if (room) {
      room.is_private = Boolean(room.is_private);
    }
    
    return room;
  }

  static getRoomWithMembers(roomId: number): RoomWithMembers | undefined {
    const room = this.getRoomById(roomId);
    if (!room) return undefined;

    const stmt = db.prepare(`
      SELECT rm.*, u.username
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = ?
      ORDER BY rm.joined_at
    `);

    const members = stmt.all(roomId) as (RoomMember & { username: string })[];
    
    // Convert is_ready from integer to boolean
    members.forEach(member => {
      member.is_ready = Boolean(member.is_ready);
    });
    
    return { ...room, members };
  }

  static getAvailableRooms(): Room[] {
    const stmt = db.prepare(`
      SELECT r.* FROM rooms r
      WHERE r.status = 'waiting'
      AND r.is_private = 0
      AND (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) < r.max_players
      ORDER BY r.created_at DESC
    `);
    
    const rooms = stmt.all() as Room[];
    
    // Convert is_private from integer to boolean
    rooms.forEach(room => {
      room.is_private = Boolean(room.is_private);
    });
    
    return rooms;
  }

  static updateRoomStatus(roomId: number, status: Room["status"]): void {
    const stmt = db.prepare("UPDATE rooms SET status = ? WHERE id = ?");
    stmt.run(status, roomId);
  }

  static deleteRoom(roomId: number): void {
    const stmt = db.prepare("DELETE FROM rooms WHERE id = ?");
    stmt.run(roomId);
  }

  static addMember(roomId: number, userId: number): RoomMember {
    const stmt = db.prepare(`
      INSERT INTO room_members (room_id, user_id)
      VALUES (?, ?)
    `);

    const result = stmt.run(roomId, userId);
    
    const getMember = db.prepare("SELECT * FROM room_members WHERE id = ?");
    const member = getMember.get(result.lastInsertRowid) as RoomMember;
    
    // Convert is_ready from integer to boolean
    member.is_ready = Boolean(member.is_ready);
    
    return member;
  }

  static removeMember(roomId: number, userId: number): void {
    const stmt = db.prepare(`
      DELETE FROM room_members
      WHERE room_id = ? AND user_id = ?
    `);
    stmt.run(roomId, userId);
  }

  static assignPlayerOrders(roomId: number): void {
    const members = db.prepare(`
      SELECT id FROM room_members WHERE room_id = ? ORDER BY joined_at
    `).all(roomId) as { id: number }[];

    const stmt = db.prepare(`
      UPDATE room_members SET player_order = ? WHERE id = ?
    `);

    members.forEach((member, index) => {
      stmt.run(index, member.id);
    });
  }

  static getRoomMembers(roomId: number): RoomMember[] {
    const stmt = db.prepare("SELECT * FROM room_members WHERE room_id = ?");
    const members = stmt.all(roomId) as RoomMember[];
    
    // Convert is_ready from integer to boolean
    members.forEach(member => {
      member.is_ready = Boolean(member.is_ready);
    });
    
    return members;
  }

  static isRoomFull(roomId: number): boolean {
    const room = this.getRoomById(roomId);
    if (!room) return true;

    const members = this.getRoomMembers(roomId);
    return members.length >= room.max_players;
  }
}