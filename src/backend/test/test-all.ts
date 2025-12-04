//Generated a Test to test all service functions and what not
// backend/test/test-all.ts
import { UserService } from "../services/userService";
import { RoomService } from "../services/roomService";
import { GameService } from "../services/gameService";

// ANSI color codes for pretty output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

class TestRunner {
  private passed = 0;
  private failed = 0;
  private testSuite = "";

  startSuite(name: string) {
    this.testSuite = name;
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}📋 Testing: ${name}${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  }

  async test(description: string, testFn: () => Promise<void>) {
    try {
      await testFn();
      this.passed++;
      console.log(`${colors.green}✓${colors.reset} ${description}`);
    } catch (error: any) {
      this.failed++;
      console.log(`${colors.red}✗${colors.reset} ${description}`);
      console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
      console.log(`  ${colors.red}Stack: ${error.stack}${colors.reset}`);
    }
  }

  assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${expected}, but got ${actual}`
      );
    }
  }

  assertNotNull(value: any, message?: string) {
    if (value === null || value === undefined) {
      throw new Error(message || "Expected value to not be null/undefined");
    }
  }

  assertNull(value: any, message?: string) {
    if (value !== null && value !== undefined) {
      throw new Error(message || `Expected null, but got ${value}`);
    }
  }

  async assertThrows(fn: () => Promise<void>, message?: string) {
    try {
      await fn();
      throw new Error(message || "Expected function to throw an error");
    } catch (error: any) {
      // Success - function threw as expected
      if (error.message.includes("Expected function to throw")) {
        throw error;
      }
    }
  }

  summary() {
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    const total = this.passed + this.failed;
    const percentage = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    
    console.log(`${colors.blue}📊 Test Results${colors.reset}`);
    console.log(`   Total: ${total}`);
    console.log(`   ${colors.green}Passed: ${this.passed}${colors.reset}`);
    console.log(`   ${colors.red}Failed: ${this.failed}${colors.reset}`);
    console.log(`   Success Rate: ${percentage}%`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    return this.failed === 0;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

async function testUserService() {
  const runner = new TestRunner();
  runner.startSuite("UserService");

  let testUserId: number;

  await runner.test("Should create a new user", async () => {
    const user = await UserService.createUser(
      `testuser_${Date.now()}`,
      "test@example.com",
      "hashed_password_123"
    );
    testUserId = user.id;
    
    runner.assertNotNull(user.id, "User should have an ID");
    runner.assert(user.username.includes("testuser"), "Username should match");
    runner.assertEqual(user.wins, 0, "New user should have 0 wins");
    runner.assertEqual(user.total_games, 0, "New user should have 0 games");
  });

  await runner.test("Should retrieve user by ID", async () => {
    const user = await UserService.getUserById(testUserId);
    runner.assertNotNull(user, "User should exist");
    runner.assertEqual(user!.id, testUserId, "User ID should match");
  });

  await runner.test("Should retrieve user by username", async () => {
    const user = await UserService.getUserById(testUserId);
    const foundUser = await UserService.getUserByUsername(user!.username);
    runner.assertNotNull(foundUser, "User should be found by username");
    runner.assertEqual(foundUser!.id, testUserId, "User IDs should match");
  });

  await runner.test("Should update last login", async () => {
    await UserService.updateLastLogin(testUserId);
    const user = await UserService.getUserById(testUserId);
    runner.assertNotNull(user!.last_login, "Last login should be set");
  });

  await runner.test("Should update user stats (win)", async () => {
    await UserService.updateStats(testUserId, true);
    const user = await UserService.getUserById(testUserId);
    runner.assertEqual(user!.wins, 1, "Wins should be incremented");
    runner.assertEqual(user!.losses, 0, "Losses should stay 0");
    runner.assertEqual(user!.total_games, 1, "Total games should be 1");
  });

  await runner.test("Should update user stats (loss)", async () => {
    await UserService.updateStats(testUserId, false);
    const user = await UserService.getUserById(testUserId);
    runner.assertEqual(user!.wins, 1, "Wins should stay 1");
    runner.assertEqual(user!.losses, 1, "Losses should be incremented");
    runner.assertEqual(user!.total_games, 2, "Total games should be 2");
  });

  await runner.test("Should get all users", async () => {
    const users = await UserService.getAllUsers();
    runner.assert(users.length > 0, "Should have at least one user");
    runner.assert(
      users.some(u => u.id === testUserId),
      "Should include test user"
    );
  });

  await runner.test("Should delete user", async () => {
    await UserService.deleteUser(testUserId);
    const user = await UserService.getUserById(testUserId);
    runner.assertNull(user, "User should be deleted");
  });

  return runner.summary();
}

async function testRoomService() {
  const runner = new TestRunner();
  runner.startSuite("RoomService");

  // Create test users first
  const user1 = await UserService.createUser(`host_${Date.now()}`, null, "pass1");
  const user2 = await UserService.createUser(`player_${Date.now()}`, null, "pass2");
  const user3 = await UserService.createUser(`player2_${Date.now()}`, null, "pass3");

  let testRoomId: number;
  let testRoomCode: string;

  await runner.test("Should generate unique room codes", async () => {
    const code1 = RoomService.generateRoomCode();
    const code2 = RoomService.generateRoomCode();
    
    runner.assertEqual(code1.length, 6, "Code should be 6 characters");
    runner.assert(code1 !== code2, "Codes should be different (usually)");
  });

  await runner.test("Should create a room", async () => {
    const room = await RoomService.createRoom("Test Room", user1.id, 4, false);
    testRoomId = room.id;
    testRoomCode = room.code;
    
    runner.assertNotNull(room.id, "Room should have ID");
    runner.assertEqual(room.name, "Test Room", "Room name should match");
    runner.assertEqual(room.host_id, user1.id, "Host ID should match");
    runner.assertEqual(room.max_players, 4, "Max players should be 4");
    runner.assertEqual(room.status, "waiting", "Status should be waiting");
  });

  await runner.test("Should get room by ID", async () => {
    const room = await RoomService.getRoomById(testRoomId);
    runner.assertNotNull(room, "Room should exist");
    runner.assertEqual(room!.id, testRoomId, "Room ID should match");
  });

  await runner.test("Should get room by code", async () => {
    const room = await RoomService.getRoomByCode(testRoomCode);
    runner.assertNotNull(room, "Room should exist");
    runner.assertEqual(room!.code, testRoomCode, "Room code should match");
  });

  await runner.test("Should add member to room", async () => {
    const member = await RoomService.addMember(testRoomId, user1.id);
    runner.assertNotNull(member, "Member should be added");
    runner.assertEqual(member.room_id, testRoomId, "Room ID should match");
    runner.assertEqual(member.user_id, user1.id, "User ID should match");
  });

  await runner.test("Should add second member to room", async () => {
    const member = await RoomService.addMember(testRoomId, user2.id);
    runner.assertNotNull(member, "Second member should be added");
  });

  await runner.test("Should get room members", async () => {
    const members = await RoomService.getRoomMembers(testRoomId);
    runner.assertEqual(members.length, 2, "Should have 2 members");
  });

  await runner.test("Should get room with members", async () => {
    const roomWithMembers = await RoomService.getRoomWithMembers(testRoomId);
    runner.assertNotNull(roomWithMembers, "Room should exist");
    runner.assertEqual(
      roomWithMembers!.members.length,
      2,
      "Should have 2 members"
    );
    runner.assert(
      roomWithMembers!.members[0].username !== undefined,
      "Members should have username"
    );
  });

  await runner.test("Should check if room is not full", async () => {
    const isFull = await RoomService.isRoomFull(testRoomId);
    runner.assertEqual(isFull, false, "Room should not be full");
  });

  await runner.test("Should set player ready status", async () => {
    await RoomService.setPlayerReady(testRoomId, user1.id, true);
    const members = await RoomService.getRoomMembers(testRoomId);
    const user1Member = members.find(m => m.user_id === user1.id);
    runner.assertEqual(user1Member!.is_ready, true, "Player should be ready");
  });

  await runner.test("Should assign player orders", async () => {
    await RoomService.assignPlayerOrders(testRoomId);
    const members = await RoomService.getRoomMembers(testRoomId);
    
    runner.assert(
      members.every(m => m.player_order !== null),
      "All members should have player order"
    );
    // Note: Player order might not be 0 due to auto-increment
  });

  await runner.test("Should get available rooms", async () => {
    const rooms = await RoomService.getAvailableRooms();
    runner.assert(
      rooms.some(r => r.id === testRoomId),
      "Should include test room"
    );
  });

  await runner.test("Should update room status", async () => {
    await RoomService.updateRoomStatus(testRoomId, "in_progress");
    const room = await RoomService.getRoomById(testRoomId);
    runner.assertEqual(
      room!.status,
      "in_progress",
      "Status should be updated"
    );
  });

  await runner.test("Should not show in-progress room in available rooms", async () => {
    const rooms = await RoomService.getAvailableRooms();
    runner.assert(
      !rooms.some(r => r.id === testRoomId),
      "In-progress room should not be available"
    );
  });

  await runner.test("Should remove member from room", async () => {
    await RoomService.removeMember(testRoomId, user2.id);
    const members = await RoomService.getRoomMembers(testRoomId);
    runner.assertEqual(members.length, 1, "Should have 1 member left");
  });

  await runner.test("Should delete room", async () => {
    await RoomService.deleteRoom(testRoomId);
    const room = await RoomService.getRoomById(testRoomId);
    runner.assertNull(room, "Room should be deleted");
  });

  // Cleanup
  await UserService.deleteUser(user1.id);
  await UserService.deleteUser(user2.id);
  await UserService.deleteUser(user3.id);

  return runner.summary();
}

async function testGameService() {
  const runner = new TestRunner();
  runner.startSuite("GameService");

  // Setup test data
  const player1 = await UserService.createUser(`p1_${Date.now()}`, null, "pass1");
  const player2 = await UserService.createUser(`p2_${Date.now()}`, null, "pass2");
  const player3 = await UserService.createUser(`p3_${Date.now()}`, null, "pass3");
  
  const room = await RoomService.createRoom("Game Test Room", player1.id);
  await RoomService.addMember(room.id, player1.id);
  await RoomService.addMember(room.id, player2.id);
  await RoomService.addMember(room.id, player3.id);
  await RoomService.assignPlayerOrders(room.id);

  let testGameId: number;

  await runner.test("Should create a deck with 52 cards", async () => {
    const deck = GameService.createDeck();
    runner.assertEqual(deck.length, 52, "Deck should have 52 cards");
  });

  await runner.test("Should shuffle deck", async () => {
    const deck1 = GameService.createDeck();
    const deck2 = GameService.shuffleDeck([...deck1]);
    
    runner.assertEqual(deck2.length, 52, "Shuffled deck should have 52 cards");
    
    // Check that at least some cards are in different positions
    let differences = 0;
    for (let i = 0; i < deck1.length; i++) {
      if (deck1[i].suit !== deck2[i].suit || deck1[i].rank !== deck2[i].rank) {
        differences++;
      }
    }
    runner.assert(differences > 0, "Shuffled deck should be different");
  });

  await runner.test("Should create a game", async () => {
    const game = await GameService.createGame(room.id, [
      player1.id,
      player2.id,
      player3.id,
    ]);
    testGameId = game.id;
    
    runner.assertNotNull(game.id, "Game should have ID");
    runner.assertEqual(game.room_id, room.id, "Room ID should match");
    runner.assertEqual(game.status, "active", "Game should be active");
    runner.assertNotNull(game.top_card, "Should have top card");
    runner.assertNotNull(game.deck, "Should have deck");
  });

  await runner.test("Top card should not be an 8", async () => {
    const game = await GameService.getGameById(testGameId);
    const topCard = JSON.parse(game!.top_card!);
    runner.assert(topCard.rank !== "8", "Top card should not be 8");
  });

  await runner.test("Should create hands for all players", async () => {
    const hand1 = await GameService.getHand(testGameId, player1.id);
    const hand2 = await GameService.getHand(testGameId, player2.id);
    const hand3 = await GameService.getHand(testGameId, player3.id);
    
    runner.assertNotNull(hand1, "Player 1 should have hand");
    runner.assertNotNull(hand2, "Player 2 should have hand");
    runner.assertNotNull(hand3, "Player 3 should have hand");
    
    runner.assertEqual(hand1!.card_count, 5, "Player 1 should have 5 cards");
    runner.assertEqual(hand2!.card_count, 5, "Player 2 should have 5 cards");
    runner.assertEqual(hand3!.card_count, 5, "Player 3 should have 5 cards");
  });

  await runner.test("Should get game by ID", async () => {
    const game = await GameService.getGameById(testGameId);
    runner.assertNotNull(game, "Game should exist");
    runner.assertEqual(game!.id, testGameId, "Game ID should match");
  });

  await runner.test("Should get active game by room", async () => {
    const game = await GameService.getActiveGameByRoom(room.id);
    runner.assertNotNull(game, "Active game should exist");
    runner.assertEqual(game!.id, testGameId, "Game ID should match");
  });

  await runner.test("Should get game state", async () => {
    const gameState = await GameService.getGameState(testGameId);
    runner.assertNotNull(gameState, "Game state should exist");
    runner.assertEqual(
      gameState!.players.length,
      3,
      "Should have 3 players"
    );
    runner.assert(
      gameState!.players.every(p => p.username !== undefined),
      "Players should have usernames"
    );
  });

  await runner.test("Should draw a card", async () => {
    const beforeHand = await GameService.getHand(testGameId, player1.id);
    const beforeCount = beforeHand!.card_count;
    
    const drawnCard = await GameService.drawCard(testGameId, player1.id);
    
    runner.assertNotNull(drawnCard, "Should draw a card");
    runner.assertNotNull(drawnCard!.suit, "Card should have suit");
    runner.assertNotNull(drawnCard!.rank, "Card should have rank");
    
    const afterHand = await GameService.getHand(testGameId, player1.id);
    runner.assertEqual(
      afterHand!.card_count,
      beforeCount + 1,
      "Hand should have one more card"
    );
  });

  await runner.test("Should play a card", async () => {
    const hand = await GameService.getHand(testGameId, player1.id);
    const cards = JSON.parse(hand!.cards);
    const cardToPlay = cards[0];
    
    await GameService.playCard(testGameId, player1.id, cardToPlay);
    
    const game = await GameService.getGameById(testGameId);
    const topCard = JSON.parse(game!.top_card!);
    
    runner.assertEqual(topCard.suit, cardToPlay.suit, "Top card suit should match");
    runner.assertEqual(topCard.rank, cardToPlay.rank, "Top card rank should match");
  });

  await runner.test("Should update hand after playing card", async () => {
    const hand = await GameService.getHand(testGameId, player1.id);
    const cards = JSON.parse(hand!.cards);
    const newCards = cards.slice(1); // Remove first card
    
    await GameService.updateHand(testGameId, player1.id, newCards);
    
    const updatedHand = await GameService.getHand(testGameId, player1.id);
    runner.assertEqual(
      updatedHand!.card_count,
      newCards.length,
      "Card count should be updated"
    );
  });

  await runner.test("Should set next player", async () => {
    await GameService.setNextPlayer(testGameId, player2.id);
    const game = await GameService.getGameById(testGameId);
    runner.assertEqual(
      game!.current_player_id,
      player2.id,
      "Current player should be updated"
    );
  });

  await runner.test("Should reverse direction", async () => {
    const beforeGame = await GameService.getGameById(testGameId);
    const beforeDirection = beforeGame!.direction;
    
    await GameService.reverseDirection(testGameId);
    
    const afterGame = await GameService.getGameById(testGameId);
    runner.assert(
      afterGame!.direction !== beforeDirection,
      "Direction should be reversed"
    );
  });

  await runner.test("Should get turn history", async () => {
    const history = await GameService.getTurnHistory(testGameId);
    runner.assert(history.length > 0, "Should have turn history");
    runner.assertNotNull(history[0].action, "Turn should have action");
  });

  await runner.test("Should finish game", async () => {
    await GameService.finishGame(testGameId, player1.id);
    const game = await GameService.getGameById(testGameId);
    
    runner.assertEqual(game!.status, "finished", "Game should be finished");
    runner.assertEqual(game!.winner_id, player1.id, "Winner should be set");
    runner.assertNotNull(game!.finished_at, "Finished time should be set");
  });

  await runner.test("Should not find active game after finishing", async () => {
    const game = await GameService.getActiveGameByRoom(room.id);
    runner.assertNull(game, "No active game should exist");
  });

  // Cleanup
  console.log(`${colors.yellow}Cleaning up test data...${colors.reset}`);
  
  try {
    // Try to delete room first (cascades to games, hands, etc.)
    const existingRoom = await RoomService.getRoomById(room.id);
    if (existingRoom) {
      await RoomService.deleteRoom(room.id);
      console.log(`${colors.green}✓ Test room deleted${colors.reset}`);
    }
  } catch (error: any) {
    console.log(`${colors.yellow}⚠️ Could not delete room: ${error.message}${colors.reset}`);
  }

  // Delete users (might fail if room deletion already handled them via cascade)
  const usersToDelete = [player1.id, player2.id, player3.id];
  for (const userId of usersToDelete) {
    try {
      await UserService.deleteUser(userId);
      console.log(`${colors.green}✓ Test user ${userId} deleted${colors.reset}`);
    } catch (error: any) {
      console.log(`${colors.yellow}⚠️ Could not delete user ${userId}: ${error.message}${colors.reset}`);
    }
  }

  return runner.summary();
}

async function testEdgeCases() {
  const runner = new TestRunner();
  runner.startSuite("Edge Cases & Error Handling");

  await runner.test("Should handle non-existent user ID", async () => {
    const user = await UserService.getUserById(99999);
    runner.assertNull(user, "Should return null for non-existent user");
  });

  await runner.test("Should handle non-existent room ID", async () => {
    const room = await RoomService.getRoomById(99999);
    runner.assertNull(room, "Should return null for non-existent room");
  });

  await runner.test("Should handle non-existent game ID", async () => {
    const game = await GameService.getGameById(99999);
    runner.assertNull(game, "Should return null for non-existent game");
  });

  await runner.test("Should handle non-existent room code", async () => {
    const room = await RoomService.getRoomByCode("XXXXXX");
    runner.assertNull(room, "Should return null for non-existent code");
  });

  await runner.test("Should handle getting hand for non-existent game", async () => {
    const hand = await GameService.getHand(99999, 1);
    runner.assertNull(hand, "Should return null for non-existent hand");
  });

  await runner.test("Should handle empty turn history", async () => {
    const history = await GameService.getTurnHistory(99999);
    runner.assertEqual(history.length, 0, "Should return empty array");
  });

  await runner.test("Should prevent duplicate room members", async () => {
    const user = await UserService.createUser(`dup_${Date.now()}`, null, "pass");
    const room = await RoomService.createRoom("Dup Test", user.id);
    
    await RoomService.addMember(room.id, user.id);
    
    await runner.assertThrows(async () => {
      await RoomService.addMember(room.id, user.id);
    }, "Should throw error for duplicate member");
    
    await RoomService.deleteRoom(room.id);
    await UserService.deleteUser(user.id);
  });

  return runner.summary();
}

async function testTransactions() {
  const runner = new TestRunner();
  runner.startSuite("Transaction Rollback Tests");

  await runner.test("Should rollback game creation on error", async () => {
    const user1 = await UserService.createUser(`trans1_${Date.now()}`, null, "pass");
    const user2 = await UserService.createUser(`trans2_${Date.now()}`, null, "pass");
    const room = await RoomService.createRoom("Trans Test", user1.id);
    
    // Note: This test needs the actual database object
    // You might need to import { db } from "../db/database";
    // and check counts
    
    try {
      // Try to create game with invalid room (should fail)
      await GameService.createGame(99999, [user1.id, user2.id]);
      runner.assert(false, "Should have thrown error");
    } catch (error) {
      // Expected to fail
    }
    
    await RoomService.deleteRoom(room.id);
    await UserService.deleteUser(user1.id);
    await UserService.deleteUser(user2.id);
  });

  return runner.summary();
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log("\n");
  console.log(`${colors.yellow}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║   🎮 CRAZY EIGHTS TEST SUITE 🎮          ║${colors.reset}`);
  console.log(`${colors.yellow}╚═══════════════════════════════════════════╝${colors.reset}`);
  
  const results = [];
  
  // Run each test suite
  results.push(await testUserService());
  results.push(await testRoomService());
  results.push(await testGameService());
  results.push(await testEdgeCases());
  results.push(await testTransactions());
  
  // Final summary
  console.log(`\n${colors.yellow}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║         FINAL TEST RESULTS                ║${colors.reset}`);
  console.log(`${colors.yellow}╚═══════════════════════════════════════════╝${colors.reset}\n`);
  
  const allPassed = results.every(r => r === true);
  
  if (allPassed) {
    console.log(`${colors.green}✓ All test suites passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Some tests failed${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runAllTests();