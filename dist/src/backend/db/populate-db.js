"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const userService_1 = require("../services/userService");
const roomService_1 = require("../services/roomService");
const gameService_1 = require("../services/gameService");
// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};
console.log(`\n${colors.cyan}╔═══════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║  🎮 Populating Crazy Eights Database 🎮  ║${colors.reset}`);
console.log(`${colors.cyan}╚═══════════════════════════════════════════╝${colors.reset}\n`);
const sampleUsers = [
    { username: 'alice', email: 'alice@example.com', password: 'hashed_pass_alice' },
    { username: 'bob', email: 'bob@example.com', password: 'hashed_pass_bob' },
    { username: 'charlie', email: 'charlie@example.com', password: 'hashed_pass_charlie' },
    { username: 'diana', email: 'diana@example.com', password: 'hashed_pass_diana' },
    { username: 'eve', email: 'eve@example.com', password: 'hashed_pass_eve' },
    { username: 'frank', email: 'frank@example.com', password: 'hashed_pass_frank' },
    { username: 'grace', email: 'grace@example.com', password: 'hashed_pass_grace' },
    { username: 'henry', email: 'henry@example.com', password: 'hashed_pass_henry' },
];
const sampleRooms = [
    { name: "Beginner's Lounge", maxPlayers: 4, isPrivate: false },
    { name: 'Quick Match', maxPlayers: 2, isPrivate: false },
    { name: 'Friday Night Games', maxPlayers: 4, isPrivate: false },
    { name: 'Private Match', maxPlayers: 3, isPrivate: true },
    { name: 'Tournament Room', maxPlayers: 4, isPrivate: false },
];
async function populateUsers() {
    console.log(`${colors.blue}👥 Creating users...${colors.reset}`);
    const users = [];
    for (const userData of sampleUsers) {
        try {
            const user = await userService_1.UserService.createUser(userData.username, userData.email, userData.password);
            const gamesPlayed = Math.floor(Math.random() * 20);
            const wins = Math.floor(Math.random() * gamesPlayed);
            for (let i = 0; i < wins; i++) {
                await userService_1.UserService.updateStats(user.id, true);
            }
            for (let i = 0; i < gamesPlayed - wins; i++) {
                await userService_1.UserService.updateStats(user.id, false);
            }
            users.push(user);
            console.log(`   ${colors.green}✓${colors.reset} Created user: ${userData.username} (${gamesPlayed} games, ${wins} wins)`);
        }
        catch (error) {
            console.log(`   ${colors.yellow}⚠${colors.reset} User ${userData.username} already exists, skipping...`);
            const existingUser = await userService_1.UserService.getUserByUsername(userData.username);
            if (existingUser)
                users.push(existingUser);
        }
    }
    return users;
}
async function populateRooms(users) {
    console.log(`\n${colors.blue}🏠 Creating rooms...${colors.reset}`);
    const rooms = [];
    for (let i = 0; i < sampleRooms.length; i++) {
        const roomData = sampleRooms[i];
        const host = users[i % users.length];
        try {
            const room = await roomService_1.RoomService.createRoom(roomData.name, host.id, roomData.maxPlayers, roomData.isPrivate);
            await roomService_1.RoomService.addMember(room.id, host.id);
            const numMembers = Math.floor(Math.random() * Math.min(3, roomData.maxPlayers - 1)) + 1;
            const availableUsers = users.filter(u => u.id !== host.id);
            for (let j = 0; j < numMembers && j < availableUsers.length; j++) {
                const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
                try {
                    await roomService_1.RoomService.addMember(room.id, randomUser.id);
                    if (Math.random() > 0.5) {
                        await roomService_1.RoomService.setPlayerReady(room.id, randomUser.id, true);
                    }
                }
                catch (error) {
                    // User might already be in room
                }
            }
            if (Math.random() > 0.3) {
                await roomService_1.RoomService.setPlayerReady(room.id, host.id, true);
            }
            const members = await roomService_1.RoomService.getRoomMembers(room.id);
            const readyCount = members.filter(m => m.is_ready).length;
            rooms.push(room);
            console.log(`   ${colors.green}✓${colors.reset} Created room: ${roomData.name} (${members.length}/${roomData.maxPlayers} players, ${readyCount} ready) [Code: ${room.code}]`);
        }
        catch (error) {
            console.log(`   ${colors.yellow}⚠${colors.reset} Error creating room ${roomData.name}: ${error.message}`);
        }
    }
    return rooms;
}
async function populateGames(users, rooms) {
    console.log(`\n${colors.blue}🎮 Creating active games...${colors.reset}`);
    const games = [];
    const numGames = Math.min(2, rooms.length);
    for (let i = 0; i < numGames; i++) {
        const room = rooms[i];
        const members = await roomService_1.RoomService.getRoomMembers(room.id);
        if (members.length >= 2) {
            try {
                for (const member of members) {
                    await roomService_1.RoomService.setPlayerReady(room.id, member.user_id, true);
                }
                await roomService_1.RoomService.assignPlayerOrders(room.id);
                await roomService_1.RoomService.updateRoomStatus(room.id, 'in_progress');
                const playerIds = members.map(m => m.user_id);
                const game = await gameService_1.GameService.createGame(room.id, playerIds);
                const numTurns = Math.floor(Math.random() * 5) + 1;
                for (let j = 0; j < numTurns; j++) {
                    const currentPlayerId = playerIds[j % playerIds.length];
                    if (Math.random() > 0.3) {
                        const hand = await gameService_1.GameService.getHand(game.id, currentPlayerId);
                        if (hand) {
                            const cards = JSON.parse(hand.cards);
                            if (cards.length > 0) {
                                const cardToPlay = cards[0];
                                await gameService_1.GameService.playCard(game.id, currentPlayerId, cardToPlay);
                                cards.splice(0, 1);
                                await gameService_1.GameService.updateHand(game.id, currentPlayerId, cards);
                            }
                        }
                    }
                    else {
                        await gameService_1.GameService.drawCard(game.id, currentPlayerId);
                    }
                }
                games.push(game);
                console.log(`   ${colors.green}✓${colors.reset} Created game in room: ${room.name} (${playerIds.length} players, ${numTurns} turns played)`);
            }
            catch (error) {
                console.log(`   ${colors.yellow}⚠${colors.reset} Error creating game in ${room.name}: ${error.message}`);
            }
        }
    }
    return games;
}
async function populateFinishedGames(users) {
    console.log(`\n${colors.blue}🏆 Creating finished games...${colors.reset}`);
    const finishedGames = [];
    for (let i = 0; i < 2; i++) {
        try {
            const host = users[i];
            const room = await roomService_1.RoomService.createRoom(`Finished Game ${i + 1}`, host.id, 4, false);
            const numPlayers = Math.floor(Math.random() * 2) + 3;
            const playerIds = [host.id];
            await roomService_1.RoomService.addMember(room.id, host.id);
            for (let j = 1; j < numPlayers && j < users.length; j++) {
                const player = users[(i + j) % users.length];
                if (!playerIds.includes(player.id)) {
                    await roomService_1.RoomService.addMember(room.id, player.id);
                    playerIds.push(player.id);
                }
            }
            for (const id of playerIds) {
                await roomService_1.RoomService.setPlayerReady(room.id, id, true);
            }
            await roomService_1.RoomService.assignPlayerOrders(room.id);
            await roomService_1.RoomService.updateRoomStatus(room.id, 'in_progress');
            const game = await gameService_1.GameService.createGame(room.id, playerIds);
            const winner = playerIds[Math.floor(Math.random() * playerIds.length)];
            await gameService_1.GameService.finishGame(game.id, winner);
            await roomService_1.RoomService.updateRoomStatus(room.id, 'finished');
            const winnerUser = users.find(u => u.id === winner);
            finishedGames.push(game);
            console.log(`   ${colors.green}✓${colors.reset} Created finished game in room: ${room.name} (Winner: ${winnerUser?.username})`);
        }
        catch (error) {
            console.log(`   ${colors.yellow}⚠${colors.reset} Error creating finished game: ${error.message}`);
        }
    }
    return finishedGames;
}
async function showSummary(users, rooms, games, finishedGames) {
    console.log(`\n${colors.cyan}╔═══════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║            DATABASE SUMMARY               ║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════╝${colors.reset}\n`);
    console.log(`${colors.magenta}📊 Statistics:${colors.reset}`);
    console.log(`   Users created:        ${users.length}`);
    console.log(`   Rooms created:        ${rooms.length}`);
    console.log(`   Active games:         ${games.length}`);
    console.log(`   Finished games:       ${finishedGames.length}`);
    console.log(`\n${colors.magenta}🎮 Sample Room Codes:${colors.reset}`);
    for (let i = 0; i < Math.min(3, rooms.length); i++) {
        const room = rooms[i];
        const members = await roomService_1.RoomService.getRoomMembers(room.id);
        console.log(`   ${room.name}: ${colors.green}${room.code}${colors.reset} (${members.length}/${room.max_players} players)`);
    }
    console.log(`\n${colors.magenta}👥 Sample Users:${colors.reset}`);
    users.slice(0, 5).forEach(user => {
        console.log(`   ${user.username}: ${user.wins}W-${user.losses}L (${user.total_games} games)`);
    });
    console.log(`\n${colors.green}✅ Database population complete!${colors.reset}\n`);
}
async function main() {
    try {
        const users = await populateUsers();
        const rooms = await populateRooms(users);
        const games = await populateGames(users, rooms);
        const finishedGames = await populateFinishedGames(users);
        await showSummary(users, rooms, games, finishedGames);
        process.exit(0);
    }
    catch (error) {
        console.error(`\n${colors.yellow}❌ Error populating database:${colors.reset}`, error.message);
        process.exit(1);
    }
}
main();
