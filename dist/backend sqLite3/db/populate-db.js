"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const userService_1 = require("../services/userService");
const roomService_1 = require("../services/roomService");
const gameService_1 = require("../services/gameService");
// ANSI color codes for pretty output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
};
console.log(`\n${colors.cyan}╔═══════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║  🎮 Populating Crazy Eights Database 🎮  ║${colors.reset}`);
console.log(`${colors.cyan}╚═══════════════════════════════════════════╝${colors.reset}\n`);
// ============================================================================
// SAMPLE DATA
// ============================================================================
const sampleUsers = [
    { username: "alice", email: "alice@example.com", password: "hashed_pass_alice" },
    { username: "bob", email: "bob@example.com", password: "hashed_pass_bob" },
    { username: "charlie", email: "charlie@example.com", password: "hashed_pass_charlie" },
    { username: "diana", email: "diana@example.com", password: "hashed_pass_diana" },
    { username: "eve", email: "eve@example.com", password: "hashed_pass_eve" },
    { username: "frank", email: "frank@example.com", password: "hashed_pass_frank" },
    { username: "grace", email: "grace@example.com", password: "hashed_pass_grace" },
    { username: "henry", email: "henry@example.com", password: "hashed_pass_henry" },
];
const sampleRooms = [
    { name: "Beginner's Lounge", maxPlayers: 4, isPrivate: false },
    { name: "Quick Match", maxPlayers: 2, isPrivate: false },
    { name: "Friday Night Games", maxPlayers: 4, isPrivate: false },
    { name: "Private Match", maxPlayers: 3, isPrivate: true },
    { name: "Tournament Room", maxPlayers: 4, isPrivate: false },
];
// ============================================================================
// POPULATION FUNCTIONS
// ============================================================================
function populateUsers() {
    console.log(`${colors.blue}👥 Creating users...${colors.reset}`);
    const users = [];
    for (const userData of sampleUsers) {
        try {
            const user = userService_1.UserService.createUser(userData.username, userData.email, userData.password);
            // Simulate some game history for variety
            const gamesPlayed = Math.floor(Math.random() * 20);
            const wins = Math.floor(Math.random() * gamesPlayed);
            for (let i = 0; i < wins; i++) {
                userService_1.UserService.updateStats(user.id, true);
            }
            for (let i = 0; i < gamesPlayed - wins; i++) {
                userService_1.UserService.updateStats(user.id, false);
            }
            users.push(user);
            console.log(`   ${colors.green}✓${colors.reset} Created user: ${userData.username} (${gamesPlayed} games, ${wins} wins)`);
        }
        catch (error) {
            console.log(`   ${colors.yellow}⚠${colors.reset} User ${userData.username} already exists, skipping...`);
            const existingUser = userService_1.UserService.getUserByUsername(userData.username);
            if (existingUser)
                users.push(existingUser);
        }
    }
    return users;
}
function populateRooms(users) {
    console.log(`\n${colors.blue}🏠 Creating rooms...${colors.reset}`);
    const rooms = [];
    for (let i = 0; i < sampleRooms.length; i++) {
        const roomData = sampleRooms[i];
        const host = users[i % users.length]; // Rotate through users as hosts
        try {
            const room = roomService_1.RoomService.createRoom(roomData.name, host.id, roomData.maxPlayers, roomData.isPrivate);
            // Add the host to the room
            roomService_1.RoomService.addMember(room.id, host.id);
            // Add 1-3 additional random members
            const numMembers = Math.floor(Math.random() * Math.min(3, roomData.maxPlayers - 1)) + 1;
            const availableUsers = users.filter(u => u.id !== host.id);
            for (let j = 0; j < numMembers && j < availableUsers.length; j++) {
                const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
                try {
                    roomService_1.RoomService.addMember(room.id, randomUser.id);
                    // Randomly set some players as ready
                    if (Math.random() > 0.5) {
                        roomService_1.RoomService.setPlayerReady(room.id, randomUser.id, true);
                    }
                }
                catch (error) {
                    // User might already be in room, skip
                }
            }
            // Sometimes set host as ready too
            if (Math.random() > 0.3) {
                roomService_1.RoomService.setPlayerReady(room.id, host.id, true);
            }
            const members = roomService_1.RoomService.getRoomMembers(room.id);
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
function populateGames(users, rooms) {
    console.log(`\n${colors.blue}🎮 Creating active games...${colors.reset}`);
    const games = [];
    // Create 2-3 active games
    const numGames = Math.min(2, rooms.length);
    for (let i = 0; i < numGames; i++) {
        const room = rooms[i];
        const members = roomService_1.RoomService.getRoomMembers(room.id);
        if (members.length >= 2) {
            try {
                // Set all players as ready
                for (const member of members) {
                    roomService_1.RoomService.setPlayerReady(room.id, member.user_id, true);
                }
                // Assign player orders
                roomService_1.RoomService.assignPlayerOrders(room.id);
                // Update room status
                roomService_1.RoomService.updateRoomStatus(room.id, "in_progress");
                // Create the game
                const playerIds = members.map(m => m.user_id);
                const game = gameService_1.GameService.createGame(room.id, playerIds);
                // Simulate some gameplay
                const numTurns = Math.floor(Math.random() * 5) + 1;
                for (let j = 0; j < numTurns; j++) {
                    const currentPlayerId = playerIds[j % playerIds.length];
                    // Random chance to draw or play
                    if (Math.random() > 0.3) {
                        const hand = gameService_1.GameService.getHand(game.id, currentPlayerId);
                        if (hand) {
                            const cards = JSON.parse(hand.cards);
                            if (cards.length > 0) {
                                // Play a card
                                const cardToPlay = cards[0];
                                gameService_1.GameService.playCard(game.id, currentPlayerId, cardToPlay);
                                cards.splice(0, 1);
                                gameService_1.GameService.updateHand(game.id, currentPlayerId, cards);
                            }
                        }
                    }
                    else {
                        // Draw a card
                        gameService_1.GameService.drawCard(game.id, currentPlayerId);
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
function populateFinishedGames(users) {
    console.log(`\n${colors.blue}🏆 Creating finished games...${colors.reset}`);
    const finishedGames = [];
    // Create 2 finished games
    for (let i = 0; i < 2; i++) {
        try {
            // Create a temporary room for finished game
            const host = users[i];
            const room = roomService_1.RoomService.createRoom(`Finished Game ${i + 1}`, host.id, 4, false);
            // Add players
            const numPlayers = Math.floor(Math.random() * 2) + 3; // 3-4 players
            const playerIds = [host.id];
            roomService_1.RoomService.addMember(room.id, host.id);
            for (let j = 1; j < numPlayers && j < users.length; j++) {
                const player = users[(i + j) % users.length];
                if (!playerIds.includes(player.id)) {
                    roomService_1.RoomService.addMember(room.id, player.id);
                    playerIds.push(player.id);
                }
            }
            // Set all ready and assign orders
            playerIds.forEach(id => roomService_1.RoomService.setPlayerReady(room.id, id, true));
            roomService_1.RoomService.assignPlayerOrders(room.id);
            roomService_1.RoomService.updateRoomStatus(room.id, "in_progress");
            // Create and finish the game
            const game = gameService_1.GameService.createGame(room.id, playerIds);
            const winner = playerIds[Math.floor(Math.random() * playerIds.length)];
            gameService_1.GameService.finishGame(game.id, winner);
            // Update room status
            roomService_1.RoomService.updateRoomStatus(room.id, "finished");
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
function showSummary(users, rooms, games, finishedGames) {
    console.log(`\n${colors.cyan}╔═══════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║            DATABASE SUMMARY               ║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════╝${colors.reset}\n`);
    console.log(`${colors.magenta}📊 Statistics:${colors.reset}`);
    console.log(`   Users created:        ${users.length}`);
    console.log(`   Rooms created:        ${rooms.length}`);
    console.log(`   Active games:         ${games.length}`);
    console.log(`   Finished games:       ${finishedGames.length}`);
    console.log(`\n${colors.magenta}🎮 Sample Room Codes:${colors.reset}`);
    rooms.slice(0, 3).forEach(room => {
        const members = roomService_1.RoomService.getRoomMembers(room.id);
        console.log(`   ${room.name}: ${colors.green}${room.code}${colors.reset} (${members.length}/${room.max_players} players)`);
    });
    console.log(`\n${colors.magenta}👥 Sample Users:${colors.reset}`);
    users.slice(0, 5).forEach(user => {
        console.log(`   ${user.username}: ${user.wins}W-${user.losses}L (${user.total_games} games)`);
    });
    console.log(`\n${colors.green}✅ Database population complete!${colors.reset}\n`);
}
// ============================================================================
// MAIN EXECUTION
// ============================================================================
function main() {
    try {
        const users = populateUsers();
        const rooms = populateRooms(users);
        const games = populateGames(users, rooms);
        const finishedGames = populateFinishedGames(users);
        showSummary(users, rooms, games, finishedGames);
        process.exit(0);
    }
    catch (error) {
        console.error(`\n${colors.yellow}❌ Error populating database:${colors.reset}`, error.message);
        process.exit(1);
    }
}
main();
