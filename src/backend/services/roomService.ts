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

    const result = await db.query(
      `INSERT INTO rooms (name, code, host_id, max_players, is_private)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, code, hostId, maxPlayers, isPrivate]
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
    const result = await db.query(
      `INSERT INTO room_members (room_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [roomId, userId]
    );
    
    return result.rows[0] as RoomMember;
  }

  static async removeMember(roomId: number, userId: number): Promise<void> {
    await db.query(
      `DELETE FROM room_members
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId]
    );
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
