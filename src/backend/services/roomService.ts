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

  static async createRoom(name: string, hostId: number, maxPlayers = 4, isPrivate = false): Promise<Room> {
    let code = this.generateRoomCode();
    
    // Ensure unique code
    while (await this.getRoomByCode(code)) {
      code = this.generateRoomCode();
    }

    // Ensure maxPlayers is within allowed limits (2..4)
    const cp = Number(maxPlayers) || 4;
    const cappedMax = Math.min(4, Math.max(2, cp));

    const result = await db.query(
      `INSERT INTO rooms (name, code, host_id, max_players, is_private)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, code, hostId, cappedMax, isPrivate]
    );
    
    return result.rows[0] as Room;
  }
  
  static async setPlayerReady(roomId: number, userId: number, isReady: boolean): Promise<void> {
    const result = await db.query(
      `UPDATE room_members
       SET is_ready = $1
       WHERE room_id = $2 AND user_id = $3`,
      [isReady, roomId, userId]
    );
    
    if (result.rowCount === 0) {
      throw new Error(`User ${userId} is not a member of room ${roomId}`);
    }
    // After updating ready status, evaluate room status (waiting vs in_progress)
    try {
      await this.evaluateRoomStatus(roomId);
    } catch (e) {
      // swallow to avoid breaking flow; evaluation is best-effort
      console.warn('Failed to evaluate room status after setPlayerReady', e);
    }
  }

  // Evaluate and update a room's status based on member counts and ready flags.
  // Rules:
  // - If the room currently has status 'in_progress', leave it unchanged.
  // - If members < max_players => 'waiting'
  // - If members >= max_players and all players ready => 'in_progress'
  // - Otherwise => 'waiting'
  static async evaluateRoomStatus(roomId: number): Promise<void> {
    const room = await this.getRoomById(roomId);
    if (!room) return;

    // If already in progress, do not change status here
    if (room.status === 'in_progress') return;

    const members = await this.getRoomMembers(roomId);
    const memberCount = members.length;

    if (memberCount < (room.max_players || 0)) {
      await this.updateRoomStatus(roomId, 'waiting');
      return;
    }

    // memberCount >= max_players
    const allReady = await this.areAllPlayersReady(roomId);
    if (allReady) {
      await this.updateRoomStatus(roomId, 'in_progress');
    } else {
      await this.updateRoomStatus(roomId, 'waiting');
    }
  }

  static async getPlayerReadyStatus(roomId: number, userId: number): Promise<boolean> {
    const result = await db.query(
      `SELECT is_ready FROM room_members
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`User ${userId} is not a member of room ${roomId}`);
    }
    
    return result.rows[0].is_ready;
  }

  static async areAllPlayersReady(roomId: number): Promise<boolean> {
    const result = await db.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_ready THEN 1 ELSE 0 END) as ready
       FROM room_members
       WHERE room_id = $1`,
      [roomId]
    );
    
    const { total, ready } = result.rows[0];
    
    // Need at least 2 players and all must be ready
    return parseInt(total) >= 2 && parseInt(ready) === parseInt(total);
  }

  static async getRoomById(id: number): Promise<Room | undefined> {
    const result = await db.query('SELECT * FROM rooms WHERE id = $1', [id]);
    return result.rows[0] as Room | undefined;
  }

  static async getRoomByCode(code: string): Promise<Room | undefined> {
    const result = await db.query('SELECT * FROM rooms WHERE code = $1', [code]);
    return result.rows[0] as Room | undefined;
  }

  static async getRoomWithMembers(roomId: number): Promise<RoomWithMembers | undefined> {
    const room = await this.getRoomById(roomId);
    if (!room) return undefined;

    const result = await db.query(
      `SELECT rm.*, u.username
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = $1
       ORDER BY rm.joined_at`,
      [roomId]
    );

    const members = result.rows as (RoomMember & { username: string })[];
    
    return { ...room, members };
  }

  static async getAvailableRooms(): Promise<Room[]> {
    const result = await db.query(
      `SELECT r.* FROM rooms r
       WHERE r.status = 'waiting'
       AND r.is_private = false
       AND (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) < r.max_players
       ORDER BY r.created_at DESC`
    );
    
    return result.rows as Room[];
  }

  static async updateRoomStatus(roomId: number, status: Room["status"]): Promise<void> {
    await db.query('UPDATE rooms SET status = $1 WHERE id = $2', [status, roomId]);
  }

  static async deleteRoom(roomId: number): Promise<void> {
    await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
  }

  static async addMember(roomId: number, userId: number): Promise<RoomMember> {
    // Ensure room exists
    const room = await this.getRoomById(roomId);
    if (!room) throw new Error('Room not found');

    // Check if user is already a member
    const existing = await db.query(
      `SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0] as RoomMember;
    }

    // Check capacity
    const members = await this.getRoomMembers(roomId);
    if (members.length >= (room.max_players || 4)) {
      throw new Error('Room is full');
    }

    const result = await db.query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [roomId, userId]
    );

    const inserted = result.rows[0] as RoomMember;

    // After adding a member, re-evaluate room status (waiting vs in_progress)
    try {
      await this.evaluateRoomStatus(roomId);
    } catch (e) {
      console.warn('Failed to evaluate room status after addMember', e);
    }

    return inserted;
  }

  static async removeMember(roomId: number, userId: number): Promise<void> {
    await db.query(
      `DELETE FROM room_members
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
    // After removing a member, re-evaluate room status (unless room deleted elsewhere)
    try {
      await this.evaluateRoomStatus(roomId);
    } catch (e) {
      console.warn('Failed to evaluate room status after removeMember', e);
    }
  }

  static async assignPlayerOrders(roomId: number): Promise<void> {
    const result = await db.query(
      `SELECT id FROM room_members WHERE room_id = $1 ORDER BY joined_at`,
      [roomId]
    );

    const members = result.rows as { id: number }[];

    for (let i = 0; i < members.length; i++) {
      await db.query(
        `UPDATE room_members SET player_order = $1 WHERE id = $2`,
        [i, members[i].id]
      );
    }
  }

  static async getRoomMembers(roomId: number): Promise<RoomMember[]> {
    const result = await db.query(
      'SELECT * FROM room_members WHERE room_id = $1',
      [roomId]
    );
    return result.rows as RoomMember[];
  }

  static async isRoomFull(roomId: number): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) return true;

    const members = await this.getRoomMembers(roomId);
    return members.length >= room.max_players;
  }
}
