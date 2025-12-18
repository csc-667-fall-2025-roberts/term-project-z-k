
(async function () {
  const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  
  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return document.querySelectorAll(selector); }

  // Get room ID from URL
  const match = location.pathname.match(/\/game\/rooms\/(\d+)/);
  const roomId = match ? parseInt(match[1]) : null;

  // State variables
  let userId = null;
  let username = 'Player';
  let isHost = false;
  let gameId = null;
  let gameStarted = false;
  let pendingCard = null;
  let isLocalGame = false;

  // Local game state (supports multiple players: index 0 is the human)
  let localState = {
    deck: [],
    players: [], // each: { name, hand: [], isHuman: bool }
    topCard: null,
    activeSuit: '',
    currentPlayer: 0, // index in players
    isPlayerTurn: true, // convenience flag for UI (true when currentPlayer === 0)
    gameOver: false
  };

  // Toast notification
  function showToast(message, duration = 2500) {
    const toast = qs('#toast-message');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  // Try to get user info
  try {
    const userResp = await fetch('/api/user', { credentials: 'same-origin' });
    if (userResp.ok) {
      const userData = await userResp.json();
      userId = userData.userId;
      username = userData.username || 'Player';
      qs('#welcome-msg').textContent = `Welcome, ${username}`;
    }
  } catch (e) {
    qs('#welcome-msg').textContent = `Welcome, ${username}`;
  }

  // Connect to socket.io
  let socket = null;
  try {
    if (typeof io !== 'undefined') {
      socket = io();
    }
  } catch (e) {
    console.log('Socket.io not available');
  }

  // =====================
  // LOCAL GAME LOGIC
  // =====================
  
  function createDeck() {
    const d = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        d.push({ suit, rank });
      }
    }
    return shuffle(d);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startLocalGame(botCount = 1) {
    // botCount = number of computer players (1-3). Human is always player 0.
    botCount = Math.max(1, Math.min(3, Number(botCount) || 1));

    isLocalGame = true;
    gameStarted = true;
    localState.deck = createDeck();
    localState.players = [];
    localState.gameOver = false;

    // Create players: human + bots
    localState.players.push({ name: username || 'You', hand: [], isHuman: true });
    for (let i = 0; i < botCount; i++) {
      localState.players.push({ name: `Computer ${i + 1}`, hand: [], isHuman: false });
    }

    // Deal 5 cards each with animation delay
    for (let i = 0; i < 5; i++) {
      for (const p of localState.players) {
        p.hand.push(localState.deck.pop());
      }
    }

    // Get starting card (not an 8)
    do {
      localState.topCard = localState.deck.pop();
    } while (localState.topCard.rank === '8');

    localState.activeSuit = localState.topCard.suit;
    localState.currentPlayer = 0;
    localState.isPlayerTurn = true;

    qs('#waiting-room').classList.add('hidden');
    qs('#game-container').classList.remove('hidden');
    qs('#winner-modal').classList.add('hidden');

    renderLocalGame();
    showToast("Game started! Your turn - play a card or draw.");
    updateStatus("Your turn!");
  }

  function canPlayCard(card, topCard, activeSuit) {
    if (!topCard) return true;
    if (card.rank === '8') return true;
    if (card.suit === activeSuit) return true;
    if (card.rank === topCard.rank) return true;
    return false;
  }

  function hasPlayableCard(hand, topCard, activeSuit) {
    return hand.some(c => canPlayCard(c, topCard, activeSuit));
  }

  function renderLocalGame() {
    const { deck, players, topCard, activeSuit, currentPlayer, isPlayerTurn, gameOver } = localState;

    // Render opponents and players
    const playersEl = qs('#players');
    playersEl.innerHTML = players.map((p, idx) => {
      const currentClass = (idx === currentPlayer) ? 'current-player' : '';
      if (p.isHuman) {
        return `<div class="player ${currentClass}">
          <span class="player-name">You</span>
          <div class="player-hand"></div>
          <span class="card-count">${p.hand.length} Cards</span>
        </div>`;
      }
      const backs = p.hand.map(() => '<div class="card card-back"></div>').join('');
      return `<div class="player ${currentClass}">
        <span class="player-name">🤖 ${p.name}</span>
        <div class="player-hand">${backs}</div>
        <span class="card-count">${p.hand.length} Cards</span>
      </div>`;
    }).join('');
    
    // Render top card
    const topEl = qs('#top-card');
    if (topCard) {
      topEl.className = `card card-${topCard.suit}`;
      topEl.innerHTML = `<span class="card-rank">${topCard.rank}</span><span class="card-suit">${SUIT_SYMBOLS[topCard.suit]}</span>`;
    }
    
    // Render active suit
    const suitColor = (activeSuit === 'hearts' || activeSuit === 'diamonds') ? 'red' : 'black';
    qs('#active-suit-display').innerHTML = `<span class="${suitColor}">${SUIT_SYMBOLS[activeSuit] || '?'}</span>`;
    
    // Render deck count
    qs('#deck-count').textContent = deck.length;
    
    // Current turn display
    qs('#current-turn').textContent = isPlayerTurn ? 'You' : 'Computer';
    
    // Render human player's hand (players[0])
    const human = players[0];
    const handEl = qs('#hand');
    handEl.innerHTML = human.hand.map((card, idx) => {
      const canPlay = isPlayerTurn && !gameOver && canPlayCard(card, topCard, activeSuit);
      const playableClass = canPlay ? 'playable' : '';
      return `<div class="card card-${card.suit} ${playableClass}" data-suit="${card.suit}" data-rank="${card.rank}" style="animation-delay: ${idx * 0.05}s">
        <span class="card-rank">${card.rank}</span>
        <span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>
      </div>`;
    }).join('');
    
    // Add click handlers
    handEl.querySelectorAll('.card.playable').forEach(el => {
      el.addEventListener('click', () => handleLocalCardClick(el));
    });
  }

  function handleLocalCardClick(el) {
    // Only allow when it's the human's turn
    if (localState.currentPlayer !== 0 || localState.gameOver) return;

    const suit = el.dataset.suit;
    const rank = el.dataset.rank;
    const card = { suit, rank };

    if (!canPlayCard(card, localState.topCard, localState.activeSuit)) {
      showToast("❌ Can't play that card!");
      return;
    }

    if (rank === '8') {
      pendingCard = card;
      qs('#suit-modal').classList.remove('hidden');
    } else {
      executeLocalPlay(card);
    }
  }

  function executeLocalPlay(card, declaredSuit = null) {
    // Play for current player (should be human when called by UI)
    const p = localState.players[localState.currentPlayer];
    const idx = p.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
    if (idx !== -1) p.hand.splice(idx, 1);

    localState.topCard = card;
    localState.activeSuit = declaredSuit || card.suit;

    const suitMsg = declaredSuit ? ` → Changed to ${SUIT_SYMBOLS[declaredSuit]}` : '';
    showToast(`${p.isHuman ? 'You' : p.name} played ${card.rank}${SUIT_SYMBOLS[card.suit]}${suitMsg}`);

    // Check win
    if (p.hand.length === 0) {
      localState.gameOver = true;
      renderLocalGame();
      updateStatus(p.isHuman ? "You win!" : `${p.name} wins!`);
      setTimeout(() => showWinner(p.isHuman ? username : p.name), 500);
      return;
    }

    // Advance turn
    localState.currentPlayer = (localState.currentPlayer + 1) % localState.players.length;
    localState.isPlayerTurn = (localState.currentPlayer === 0);
    renderLocalGame();
    updateStatus(localState.isPlayerTurn ? "Your turn!" : "Computer thinking...");

    if (!localState.isPlayerTurn && !localState.gameOver) {
      setTimeout(computerTurn, 1200);
    }
  }

  function computerTurn() {
    if (localState.gameOver) return;

    const idx = localState.currentPlayer;
    const p = localState.players[idx];
    const { topCard, activeSuit, deck } = localState;

    // Find playable cards for this bot
    const playable = p.hand.filter(c => canPlayCard(c, topCard, activeSuit));

    if (playable.length > 0) {
      // Strategy: prefer matching suit, then rank, save 8s
      const suitMatches = playable.filter(c => c.suit === activeSuit && c.rank !== '8');
      const rankMatches = playable.filter(c => c.rank === topCard.rank && c.rank !== '8');
      const eights = playable.filter(c => c.rank === '8');

      let cardToPlay;
      if (suitMatches.length > 0) {
        cardToPlay = suitMatches[0];
      } else if (rankMatches.length > 0) {
        cardToPlay = rankMatches[0];
      } else if (playable.filter(c => c.rank !== '8').length > 0) {
        cardToPlay = playable.filter(c => c.rank !== '8')[0];
      } else {
        cardToPlay = eights[0];
      }

      // Remove from hand
      const removeIdx = p.hand.findIndex(c => c.suit === cardToPlay.suit && c.rank === cardToPlay.rank);
      if (removeIdx !== -1) p.hand.splice(removeIdx, 1);

      localState.topCard = cardToPlay;

      // If 8, pick best suit
      if (cardToPlay.rank === '8') {
        const suitCounts = {};
        SUITS.forEach(s => suitCounts[s] = p.hand.filter(c => c.suit === s).length);
        localState.activeSuit = SUITS.reduce((a, b) => suitCounts[a] > suitCounts[b] ? a : b);
        showToast(`${p.name}: ${cardToPlay.rank}${SUIT_SYMBOLS[cardToPlay.suit]} → ${SUIT_SYMBOLS[localState.activeSuit]}`);
      } else {
        localState.activeSuit = cardToPlay.suit;
        showToast(`${p.name} played ${cardToPlay.rank}${SUIT_SYMBOLS[cardToPlay.suit]}`);
      }

      // Check win
      if (p.hand.length === 0) {
        localState.gameOver = true;
        renderLocalGame();
        updateStatus(`${p.name} wins!`);
        setTimeout(() => showWinner(p.name), 500);
        return;
      }
    } else {
      // Draw a card
      if (deck.length > 0) {
        p.hand.push(deck.pop());
        showToast(`${p.name} drew a card`);
      } else {
        showToast(`${p.name} passed (empty deck)`);
      }
    }

    // Advance to next player
    localState.currentPlayer = (localState.currentPlayer + 1) % localState.players.length;
    localState.isPlayerTurn = (localState.currentPlayer === 0);
    renderLocalGame();

    if (localState.isPlayerTurn) {
      setTimeout(() => {
        if (!localState.gameOver) {
          if (hasPlayableCard(localState.players[0].hand, localState.topCard, localState.activeSuit)) {
            updateStatus("Your turn!");
          } else {
            updateStatus("No playable cards - draw!");
          }
        }
      }, 300);
    } else {
      // If next is another bot, chain the bot turn
      if (!localState.gameOver) setTimeout(computerTurn, 800 + Math.random() * 800);
    }
  }

  function localDrawCard() {
    // Human draws a card when it's their turn
    if (localState.currentPlayer !== 0 || localState.gameOver) return;

    if (localState.deck.length > 0) {
      const card = localState.deck.pop();
      localState.players[0].hand.push(card);
      showToast(`Drew ${card.rank}${SUIT_SYMBOLS[card.suit]}`);
    } else {
      showToast("Deck empty! Passing...");
    }

    // Advance to next player (computer)
    localState.currentPlayer = (localState.currentPlayer + 1) % localState.players.length;
    localState.isPlayerTurn = (localState.currentPlayer === 0);
    renderLocalGame();
    updateStatus("Computer thinking...");
    if (!localState.isPlayerTurn) setTimeout(computerTurn, 1200);
  }

  function updateStatus(msg) {
    qs('#game-status').textContent = msg;
  }

  // =====================
  // ONLINE GAME LOGIC
  // =====================

  async function loadRoom() {
    if (!roomId) return;
    
    try {
      const res = await fetch(`/api/game/rooms/${roomId}`);
      if (!res.ok) return;
      
      const room = await res.json();
      qs('#code-display').textContent = room.code;
      isHost = userId && Number(room.host_id) === Number(userId);
      
      if (userId) {
        const isMember = room.members?.some(m => Number(m.user_id) === Number(userId));
        if (!isMember) {
          await fetch(`/api/game/rooms/${room.code}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
        }
      }
      
      renderMembers(room.members || []);
      
      if (room.status === 'in_progress') {
        await startOnlineGameUI();
      }
    } catch (e) {
      console.error('Failed to load room:', e);
    }
  }

  function renderMembers(members) {
    const list = qs('#member-list');
    list.innerHTML = members.map(m => {
      const readyClass = m.is_ready ? 'ready' : '';
      const readyText = m.is_ready ? '✓ Ready' : '○ Waiting';
      const isMe = userId && Number(m.user_id) === Number(userId);
      return `<li class="${readyClass}">
        <span>${m.username}${isMe ? ' (You)' : ''}</span>
        <span style="color: ${m.is_ready ? '#2e7d32' : '#757575'}">${readyText}</span>
      </li>`;
    }).join('');
    
    const allReady = members.length >= 2 && members.every(m => m.is_ready);
    const startBtn = qs('#start-btn');
    startBtn.disabled = !isHost || !allReady;
    startBtn.style.display = isHost ? 'inline-block' : 'none';
  }

  // Ready button
  qs('#ready-btn').addEventListener('click', async () => {
    if (!userId) {
      showToast("Please log in first");
      return;
    }
    
    const btn = qs('#ready-btn');
    const currentlyReady = btn.classList.contains('not-ready') ? false : true;
    const newReady = !currentlyReady;
    
    try {
      const res = await fetch(`/api/game/rooms/${roomId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isReady: newReady })
      });
      
      if (res.ok) {
        btn.classList.toggle('not-ready', !newReady);
        btn.textContent = newReady ? '✗ Cancel' : '✓ Ready';
        loadRoom();
      }
    } catch (e) {
      console.error('Failed to set ready:', e);
    }
  });

  // Start online game
  qs('#start-btn').addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/game/rooms/${roomId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const game = await res.json();
        gameId = game.id;
        if (socket) socket.emit('joinGame', { gameId });
        await startOnlineGameUI();
      } else {
        const data = await res.json();
        showToast('Error: ' + (data.error || 'Failed to start'));
      }
    } catch (e) {
      console.error('Failed to start game:', e);
    }
  });

  // Local play button — read bot count selector
  qs('#local-play-btn').addEventListener('click', () => {
    const sel = document.getElementById('local-bot-count');
    const bots = sel ? parseInt(sel.value || '1') : 1;
    startLocalGame(bots);
  });

  // Winner modal 'New Game' button: restart local game with selected bot count
  const newGameBtn = qs('#new-game-btn');
  if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
      const sel = document.getElementById('local-bot-count');
      const bots = sel ? parseInt(sel.value || '1') : 1;
      // Hide winner modal (startLocalGame will also hide it)
      const modal = qs('#winner-modal');
      if (modal) modal.classList.add('hidden');
      startLocalGame(bots);
    });
  }

  async function startOnlineGameUI() {
    gameStarted = true;
    isLocalGame = false;
    qs('#waiting-room').classList.add('hidden');
    qs('#game-container').classList.remove('hidden');
    
    if (!gameId) gameId = roomId;
    if (socket) socket.emit('joinGame', { gameId: roomId });
    await loadGameState();
  }

  async function loadGameState() {
    if (isLocalGame) return;
    
    try {
      let res = await fetch(`/api/game/games/${roomId}`);
      if (!res.ok) return;
      
      const state = await res.json();
      gameId = roomId;

      const handRes = await fetch(`/api/game/games/${gameId}/hand/${userId}`);
      const hand = handRes.ok ? await handRes.json() : [];
      
      renderOnlineGameState(state, hand);
    } catch (e) {
      console.error('Failed to load game state:', e);
    }
  }

  function renderOnlineGameState(state, hand) {
    const topCard = typeof state.top_card === 'string' ? JSON.parse(state.top_card) : state.top_card;
    const activeSuit = state.active_suit;
    const currentPlayerId = state.current_player_id;
    const players = state.players || [];
    
    // Top card
    const topEl = qs('#top-card');
    if (topCard) {
      topEl.className = `card card-${topCard.suit}`;
      topEl.innerHTML = `<span class="card-rank">${topCard.rank}</span><span class="card-suit">${SUIT_SYMBOLS[topCard.suit]}</span>`;
    }
    
    // Active suit
    const suitColor = (activeSuit === 'hearts' || activeSuit === 'diamonds') ? 'red' : 'black';
    qs('#active-suit-display').innerHTML = `<span class="${suitColor}">${SUIT_SYMBOLS[activeSuit] || '?'}</span>`;
    
    // Deck count
    const deck = typeof state.deck === 'string' ? JSON.parse(state.deck) : (state.deck || []);
    qs('#deck-count').textContent = deck.length;
    
    // Current player
    const currentPlayer = players.find(p => Number(p.user_id) === Number(currentPlayerId));
    qs('#current-turn').textContent = currentPlayer ? currentPlayer.username : '-';
    
    // Other players
    const otherPlayers = players.filter(p => Number(p.user_id) !== Number(userId));
    const playersEl = qs('#players');
    playersEl.innerHTML = otherPlayers.map(p => {
      const isCurrent = Number(p.user_id) === Number(currentPlayerId);
      const currentClass = isCurrent ? 'current-player' : '';
      const cardBacks = Array(p.card_count || 0).fill('<div class="card card-back"></div>').join('');
      return `<div class="player ${currentClass}">
        <span class="player-name">${p.username}</span>
        <div class="player-hand">${cardBacks}</div>
        <span class="card-count">${p.card_count} Cards</span>
      </div>`;
    }).join('');
    
    // Player's hand
    const isMyTurn = Number(currentPlayerId) === Number(userId);
    const handEl = qs('#hand');
    handEl.innerHTML = hand.map((card, idx) => {
      const canPlay = isMyTurn && canPlayCard(card, topCard, activeSuit);
      const playableClass = canPlay ? 'playable' : '';
      return `<div class="card card-${card.suit} ${playableClass}" data-suit="${card.suit}" data-rank="${card.rank}">
        <span class="card-rank">${card.rank}</span>
        <span class="card-suit">${SUIT_SYMBOLS[card.suit]}</span>
      </div>`;
    }).join('');
    
    handEl.querySelectorAll('.card.playable').forEach(el => {
      el.addEventListener('click', () => handleOnlineCardClick(el));
    });
    
    updateStatus(state.status === 'finished' ? 'Game Over' : (isMyTurn ? 'Your Turn!' : 'Waiting...'));
    
    if (state.status === 'finished' && state.winner_id) {
      const winner = players.find(p => Number(p.user_id) === Number(state.winner_id));
      showWinner(winner ? winner.username : 'Unknown');
    }
  }

  function handleOnlineCardClick(el) {
    const suit = el.dataset.suit;
    const rank = el.dataset.rank;
    const card = { suit, rank };
    
    if (rank === '8') {
      pendingCard = card;
      qs('#suit-modal').classList.remove('hidden');
    } else {
      playOnlineCard(card);
    }
  }

  async function playOnlineCard(card, declaredSuit = null) {
    try {
      const body = { userId, card };
      if (declaredSuit) body.declaredSuit = declaredSuit;
      
      const res = await fetch(`/api/game/games/${gameId}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast('Error: ' + (data.error || res.statusText));
      } else {
        showToast(`Played ${card.rank}${SUIT_SYMBOLS[card.suit]}`);
        await loadGameState();
      }
    } catch (e) {
      console.error('Failed to play card:', e);
    }
  }

  // Suit selection
  qsa('.suit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const suit = btn.dataset.suit;
      qs('#suit-modal').classList.add('hidden');
      if (pendingCard) {
        if (isLocalGame) {
          executeLocalPlay(pendingCard, suit);
        } else {
          playOnlineCard(pendingCard, suit);
        }
        pendingCard = null;
      }
    });
  });

  // Draw card
  qs('#deck').addEventListener('click', async () => {
    if (!gameStarted) return;
    
    if (isLocalGame) {
      localDrawCard();
      return;
    }
    
    try {
      const res = await fetch(`/api/game/games/${gameId}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast('Error: ' + (data.error || res.statusText));
      } else {
        const card = await res.json();
        showToast(`Drew ${card.rank}${SUIT_SYMBOLS[card.suit]}`);
        await loadGameState();
      }
    } catch (e) {
      console.error('Failed to draw card:', e);
    }
  });

  function showWinner(winnerName) {
    qs('#winner-text').textContent = `🎉 ${winnerName} Wins! 🎉`;
    qs('#winner-modal').classList.remove('hidden');
  }

  // Socket events
  if (socket) {
    socket.on('connect', () => {
      if (roomId) socket.emit('joinGame', { gameId: roomId });
    });

    socket.on('game:started', async (data) => {
      gameId = data.gameId || roomId;
      await startOnlineGameUI();
    });

    socket.on('game:update', async (data) => {
      if (!isLocalGame) {
        if (data.state) {
          const handRes = await fetch(`/api/game/games/${gameId}/hand/${userId}`);
          const hand = handRes.ok ? await handRes.json() : [];
          renderOnlineGameState(data.state, hand);
        } else {
          await loadGameState();
        }
      }
    });

    socket.on('room:deleted', () => {
      showToast('Room was deleted');
      setTimeout(() => window.location.href = '/lobby', 1500);
    });
  }

  // Initial load
  await loadRoom();

})();
