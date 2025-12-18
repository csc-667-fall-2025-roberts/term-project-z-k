
import { UserService } from "../services/userService";
import { RoomService } from "../services/roomService";
import { GameService } from "../services/gameService";
import { db } from "../db/database";

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

  test(description: string, testFn: () => void) {
    try {
      testFn();
      this.passed++;
      console.log(`${colors.green}✓${colors.reset} ${description}`);
    } catch (error: any) {
      this.failed++;
      console.log(`${colors.red}✗${colors.reset} ${description}`);
      console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
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

  assertThrows(fn: () => void, message?: string) {
    try {
      fn();
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

function testUserService() {
  const runner = new TestRunner();
  runner.startSuite("UserService");

  let testUserId: number;

  runner.test("Should create a new user", () => {
    const user = UserService.createUser(
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

  runner.test("Should retrieve user by ID", () => {
    const user = UserService.getUserById(testUserId);
    runner.assertNotNull(user, "User should exist");
    runner.assertEqual(user!.id, testUserId, "User ID should match");
  });

  runner.test("Should retrieve user by username", () => {
    const user = UserService.getUserById(testUserId);
    const foundUser = UserService.getUserByUsername(user!.username);
    runner.assertNotNull(foundUser, "User should be found by username");
    runner.assertEqual(foundUser!.id, testUserId, "User IDs should match");
  });

  runner.test("Should update last login", () => {
    UserService.updateLastLogin(testUserId);
    const user = UserService.getUserById(testUserId);
    runner.assertNotNull(user!.last_login, "Last login should be set");
  });

  runner.test("Should update user stats (win)", () => {
    UserService.updateStats(testUserId, true);
    const user = UserService.getUserById(testUserId);
    runner.assertEqual(user!.wins, 1, "Wins should be incremented");
    runner.assertEqual(user!.losses, 0, "Losses should stay 0");
    runner.assertEqual(user!.total_games, 1, "Total games should be 1");
  });

  runner.test("Should update user stats (loss)", () => {
    UserService.updateStats(testUserId, false);
    const user = UserService.getUserById(testUserId);
    runner.assertEqual(user!.wins, 1, "Wins should stay 1");
    runner.assertEqual(user!.losses, 1, "Losses should be incremented");
    runner.assertEqual(user!.total_games, 2, "Total games should be 2");
  });

  runner.test("Should get all users", () => {
    const users = UserService.getAllUsers();
    runner.assert(users.length > 0, "Should have at least one user");
    runner.assert(
      users.some(u => u.id === testUserId),
      "Should include test user"
    );
  });

  runner.test("Should delete user", () => {
    UserService.deleteUser(testUserId);
    const user = UserService.getUserById(testUserId);
    runner.assertNull(user, "User should be deleted");
  });

  return runner.summary();
}

function testRoomService() {
  const runner = new TestRunner();
  runner.startSuite("RoomService");

  // Create test users first
  const user1 = UserService.createUser(`host_${Date.now()}`, null, "pass1");
  const user2 = UserService.createUser(`player_${Date.now()}`, null, "pass2");
  const user3 = UserService.createUser(`player2_${Date.now()}`, null, "pass3");

  let testRoomId: number;
  let testRoomCode: string;

  runner.test("Should generate unique room codes", () => {
    const code1 = RoomService.generateRoomCode();
    const code2 = RoomService.generateRoomCode();
    
    runner.assertEqual(code1.length, 6, "Code should be 6 characters");
    runner.assert(code1 !== code2, "Codes should be different (usually)");
  });

  runner.test("Should create a room", () => {
    const room = RoomService.createRoom("Test Room", user1.id, 4, false);
    testRoomId = room.id;
    testRoomCode = room.code;
    
    runner.assertNotNull(room.id, "Room should have ID");
    runner.assertEqual(room.name, "Test Room", "Room name should match");
    runner.assertEqual(room.host_id, user1.id, "Host ID should match");
    runner.assertEqual(room.max_players, 4, "Max players should be 4");
    runner.assertEqual(room.status, "waiting", "Status should be waiting");
  });

  runner.test("Should get room by ID", () => {
    const room = RoomService.getRoomById(testRoomId);
    runner.assertNotNull(room, "Room should exist");
    runner.assertEqual(room!.id, testRoomId, "Room ID should match");
  });

  runner.test("Should get room by code", () => {
    const room = RoomService.getRoomByCode(testRoomCode);
    runner.assertNotNull(room, "Room should exist");
    runner.assertEqual(room!.code, testRoomCode, "Room code should match");
  });

  runner.test("Should add member to room", () => {
    const member = RoomService.addMember(testRoomId, user1.id);
    runner.assertNotNull(member, "Member should be added");
    runner.assertEqual(member.room_id, testRoomId, "Room ID should match");
    runner.assertEqual(member.user_id, user1.id, "User ID should match");
  });

  runner.test("Should add second member to room", () => {
    const member = RoomService.addMember(testRoomId, user2.id);
    runner.assertNotNull(member, "Second member should be added");
  });

  runner.test("Should get room members", () => {
    const members = RoomService.getRoomMembers(testRoomId);
    runner.assertEqual(members.length, 2, "Should have 2 members");
  });

  runner.test("Should get room with members", () => {
    const roomWithMembers = RoomService.getRoomWithMembers(testRoomId);
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

  runner.test("Should check if room is not full", () => {
    const isFull = RoomService.isRoomFull(testRoomId);
    runner.assertEqual(isFull, false, "Room should not be full");
  });

  runner.test("Should set player ready status", () => {
    RoomService.setPlayerReady(testRoomId, user1.id, true);
    const members = RoomService.getRoomMembers(testRoomId);
    const user1Member = members.find(m => m.user_id === user1.id);
    runner.assertEqual(user1Member!.is_ready, true, "Player should be ready");
  });

  runner.test("Should assign player orders", () => {
    RoomService.assignPlayerOrders(testRoomId);
    const members = RoomService.getRoomMembers(testRoomId);
    
    runner.assert(
      members.every(m => m.player_order !== null),
      "All members should have player order"
    );
    runner.assertEqual(
      members[0].player_order,
      0,
      "First member should have order 0"
    );
  });

  runner.test("Should get available rooms", () => {
    const rooms = RoomService.getAvailableRooms();
    runner.assert(
      rooms.some(r => r.id === testRoomId),
      "Should include test room"
    );
  });

  runner.test("Should update room status", () => {
    RoomService.updateRoomStatus(testRoomId, "in_progress");
    const room = RoomService.getRoomById(testRoomId);
    runner.assertEqual(
      room!.status,
      "in_progress",
      "Status should be updated"
    );
  });

  runner.test("Should not show in-progress room in available rooms", () => {
    const rooms = RoomService.getAvailableRooms();
    runner.assert(
      !rooms.some(r => r.id === testRoomId),
      "In-progress room should not be available"
    );
  });

  runner.test("Should remove member from room", () => {
    RoomService.removeMember(testRoomId, user2.id);
    const members = RoomService.getRoomMembers(testRoomId);
    runner.assertEqual(members.length, 1, "Should have 1 member left");
  });

  runner.test("Should delete room", () => {
    RoomService.deleteRoom(testRoomId);
    const room = RoomService.getRoomById(testRoomId);
    runner.assertNull(room, "Room should be deleted");
  });

  // Cleanup
  UserService.deleteUser(user1.id);
  UserService.deleteUser(user2.id);
  UserService.deleteUser(user3.id);

  return runner.summary();
}

function testGameService() {
  const runner = new TestRunner();
  runner.startSuite("GameService");

  // Setup test data
  const player1 = UserService.createUser(`p1_${Date.now()}`, null, "pass1");
  const player2 = UserService.createUser(`p2_${Date.now()}`, null, "pass2");
  const player3 = UserService.createUser(`p3_${Date.now()}`, null, "pass3");
  
  const room = RoomService.createRoom("Game Test Room", player1.id);
  RoomService.addMember(room.id, player1.id);
  RoomService.addMember(room.id, player2.id);
  RoomService.addMember(room.id, player3.id);
  RoomService.assignPlayerOrders(room.id);

  let testGameId: number;

  runner.test("Should create a deck with 52 cards", () => {
    const deck = GameService.createDeck();
    runner.assertEqual(deck.length, 52, "Deck should have 52 cards");
  });

  runner.test("Should shuffle deck", () => {
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

  runner.test("Should create a game", () => {
    const game = GameService.createGame(room.id, [
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

  runner.test("Top card should not be an 8", () => {
    const game = GameService.getGameById(testGameId);
    const topCard = JSON.parse(game!.top_card!);
    runner.assert(topCard.rank !== "8", "Top card should not be 8");
  });

  runner.test("Should create hands for all players", () => {
    const hand1 = GameService.getHand(testGameId, player1.id);
    const hand2 = GameService.getHand(testGameId, player2.id);
    const hand3 = GameService.getHand(testGameId, player3.id);
    
    runner.assertNotNull(hand1, "Player 1 should have hand");
    runner.assertNotNull(hand2, "Player 2 should have hand");
    runner.assertNotNull(hand3, "Player 3 should have hand");
    
    runner.assertEqual(hand1!.card_count, 5, "Player 1 should have 5 cards");
    runner.assertEqual(hand2!.card_count, 5, "Player 2 should have 5 cards");
    runner.assertEqual(hand3!.card_count, 5, "Player 3 should have 5 cards");
  });

  runner.test("Should get game by ID", () => {
    const game = GameService.getGameById(testGameId);
    runner.assertNotNull(game, "Game should exist");
    runner.assertEqual(game!.id, testGameId, "Game ID should match");
  });

  runner.test("Should get active game by room", () => {
    const game = GameService.getActiveGameByRoom(room.id);
    runner.assertNotNull(game, "Active game should exist");
    runner.assertEqual(game!.id, testGameId, "Game ID should match");
  });

  runner.test("Should get game state", () => {
    const gameState = GameService.getGameState(testGameId);
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

  runner.test("Should draw a card", () => {
    const beforeHand = GameService.getHand(testGameId, player1.id);
    const beforeCount = beforeHand!.card_count;
    
    const drawnCard = GameService.drawCard(testGameId, player1.id);
    
    runner.assertNotNull(drawnCard, "Should draw a card");
    runner.assertNotNull(drawnCard!.suit, "Card should have suit");
    runner.assertNotNull(drawnCard!.rank, "Card should have rank");
    
    const afterHand = GameService.getHand(testGameId, player1.id);
    runner.assertEqual(
      afterHand!.card_count,
      beforeCount + 1,
      "Hand should have one more card"
    );
  });

  runner.test("Should play a card", () => {
    const hand = GameService.getHand(testGameId, player1.id);
    const cards = JSON.parse(hand!.cards);
    const cardToPlay = cards[0];
    
    GameService.playCard(testGameId, player1.id, cardToPlay);
    
    const game = GameService.getGameById(testGameId);
    const topCard = JSON.parse(game!.top_card!);
    
    runner.assertEqual(topCard.suit, cardToPlay.suit, "Top card suit should match");
    runner.assertEqual(topCard.rank, cardToPlay.rank, "Top card rank should match");
  });

  runner.test("Should update hand after playing card", () => {
    const hand = GameService.getHand(testGameId, player1.id);
    const cards = JSON.parse(hand!.cards);
    const newCards = cards.slice(1); // Remove first card
    
    GameService.updateHand(testGameId, player1.id, newCards);
    
    const updatedHand = GameService.getHand(testGameId, player1.id);
    runner.assertEqual(
      updatedHand!.card_count,
      newCards.length,
      "Card count should be updated"
    );
  });

  runner.test("Should set next player", () => {
    GameService.setNextPlayer(testGameId, player2.id);
    const game = GameService.getGameById(testGameId);
    runner.assertEqual(
      game!.current_player_id,
      player2.id,
      "Current player should be updated"
    );
  });

  runner.test("Should reverse direction", () => {
    const beforeGame = GameService.getGameById(testGameId);
    const beforeDirection = beforeGame!.direction;
    
    GameService.reverseDirection(testGameId);
    
    const afterGame = GameService.getGameById(testGameId);
    runner.assert(
      afterGame!.direction !== beforeDirection,
      "Direction should be reversed"
    );
  });

  runner.test("Should get turn history", () => {
    const history = GameService.getTurnHistory(testGameId);
    runner.assert(history.length > 0, "Should have turn history");
    runner.assertNotNull(history[0].action, "Turn should have action");
  });

  runner.test("Should finish game", () => {
    GameService.finishGame(testGameId, player1.id);
    const game = GameService.getGameById(testGameId);
    
    runner.assertEqual(game!.status, "finished", "Game should be finished");
    runner.assertEqual(game!.winner_id, player1.id, "Winner should be set");
    runner.assertNotNull(game!.finished_at, "Finished time should be set");
  });

  runner.test("Should not find active game after finishing", () => {
    const game = GameService.getActiveGameByRoom(room.id);
    runner.assertNull(game, "No active game should exist");
  });

  // Cleanup
  RoomService.deleteRoom(room.id);
  UserService.deleteUser(player1.id);
  UserService.deleteUser(player2.id);
  UserService.deleteUser(player3.id);

  return runner.summary();
}

function testEdgeCases() {
  const runner = new TestRunner();
  runner.startSuite("Edge Cases & Error Handling");

  runner.test("Should handle non-existent user ID", () => {
    const user = UserService.getUserById(99999);
    runner.assertNull(user, "Should return null for non-existent user");
  });

  runner.test("Should handle non-existent room ID", () => {
    const room = RoomService.getRoomById(99999);
    runner.assertNull(room, "Should return null for non-existent room");
  });

  runner.test("Should handle non-existent game ID", () => {
    const game = GameService.getGameById(99999);
    runner.assertNull(game, "Should return null for non-existent game");
  });

  runner.test("Should handle non-existent room code", () => {
    const room = RoomService.getRoomByCode("XXXXXX");
    runner.assertNull(room, "Should return null for non-existent code");
  });

  runner.test("Should handle getting hand for non-existent game", () => {
    const hand = GameService.getHand(99999, 1);
    runner.assertNull(hand, "Should return null for non-existent hand");
  });

  runner.test("Should handle empty turn history", () => {
    const history = GameService.getTurnHistory(99999);
    runner.assertEqual(history.length, 0, "Should return empty array");
  });

  runner.test("Should prevent duplicate room members", () => {
    const user = UserService.createUser(`dup_${Date.now()}`, null, "pass");
    const room = RoomService.createRoom("Dup Test", user.id);
    
    RoomService.addMember(room.id, user.id);
    
    runner.assertThrows(() => {
      RoomService.addMember(room.id, user.id);
    }, "Should throw error for duplicate member");
    
    RoomService.deleteRoom(room.id);
    UserService.deleteUser(user.id);
  });

  return runner.summary();
}

function testTransactions() {
  const runner = new TestRunner();
  runner.startSuite("Transaction Rollback Tests");

  runner.test("Should rollback game creation on error", () => {
    const user1 = UserService.createUser(`trans1_${Date.now()}`, null, "pass");
    const user2 = UserService.createUser(`trans2_${Date.now()}`, null, "pass");
    const room = RoomService.createRoom("Trans Test", user1.id);
    
    const gamesBefore = db.prepare("SELECT COUNT(*) as count FROM games").get() as { count: number };
    const handsBefore = db.prepare("SELECT COUNT(*) as count FROM hands").get() as { count: number };
    
    try {
      // Try to create game with invalid room (should fail)
      GameService.createGame(99999, [user1.id, user2.id]);
      runner.assert(false, "Should have thrown error");
    } catch (error) {
      // Expected to fail
    }
    
    const gamesAfter = db.prepare("SELECT COUNT(*) as count FROM games").get() as { count: number };
    const handsAfter = db.prepare("SELECT COUNT(*) as count FROM hands").get() as { count: number };
    
    runner.assertEqual(
      gamesBefore.count,
      gamesAfter.count,
      "Games count should not change on rollback"
    );
    runner.assertEqual(
      handsBefore.count,
      handsAfter.count,
      "Hands count should not change on rollback"
    );
    
    RoomService.deleteRoom(room.id);
    UserService.deleteUser(user1.id);
    UserService.deleteUser(user2.id);
  });

  return runner.summary();
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

function runAllTests() {
  console.log("\n");
  console.log(`${colors.yellow}╔═══════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║   🎮 CRAZY EIGHTS TEST SUITE 🎮          ║${colors.reset}`);
  console.log(`${colors.yellow}╚═══════════════════════════════════════════╝${colors.reset}`);
  
  const results = [];
  
  // Run each test suite
  results.push(testUserService());
  results.push(testRoomService());
  results.push(testGameService());
  results.push(testEdgeCases());
  results.push(testTransactions());
  
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