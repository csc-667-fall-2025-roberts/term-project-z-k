// Minimal socket-driven game client for Crazy Eights
(async function () {
  function qs(selector) { return document.querySelector(selector); }

  const match = location.pathname.match(/\/game\/rooms\/(\d+)/);
  if (!match) return;
  const gameId = parseInt(match[1]);

  // get current user
  const userResp = await fetch('/api/user', { credentials: 'same-origin' });
  const user = await userResp.json();
  const userId = user.userId;

  // connect socket.io
  const socket = io();
  socket.emit('joinGame', { gameId });

  socket.on('connect', () => console.log('socket connected'));
  socket.on('game:started', () => {
    loadState();
  });

  socket.on('game:update', (data) => {
    console.log('game:update', data);
    renderState(data.state, data.hand, data.userId);
  });

  async function loadState() {
    const res = await fetch(`/api/game/games/${gameId}`);
    if (!res.ok) return;
    const state = await res.json();
    const handRes = await fetch(`/api/game/games/${gameId}/hand/${userId}`);
    const hand = handRes.ok ? await handRes.json() : [];
    renderState(state, hand, userId);
  }

  function renderCard(card) {
    return `<div class="card card-${card.suit} playable" data-suit="${card.suit}" data-rank="${card.rank}"><span class="card-rank">${card.rank}</span><span class="card-suit">${card.suit[0].toUpperCase()}</span></div>`;
  }

  function renderState(state, hand, forUserId) {
    // top card
    const top = state.top_card ? JSON.parse(state.top_card) : null;
    if (top) {
      const field = qs('#field');
      if (field) field.innerHTML = `<div class="card card-${top.suit}"><span class="card-rank">${top.rank}</span><span class="card-suit">${top.suit[0].toUpperCase()}</span></div>`;
    }

    // player's hand
    const handEl = qs('#hand');
    if (handEl) {
      handEl.innerHTML = hand.map(renderCard).join('');
      handEl.querySelectorAll('.playable').forEach(el => {
        el.addEventListener('click', async (ev) => {
          const suit = el.getAttribute('data-suit');
          const rank = el.getAttribute('data-rank');
          const card = { suit, rank };
          let declaredSuit = undefined;
          if (rank === '8') {
            declaredSuit = prompt('You played an 8. Choose a suit (hearts, diamonds, clubs, spades)');
          }
          const resp = await fetch(`/api/game/games/${gameId}/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: forUserId, card, declaredSuit })
          });
          if (!resp.ok) {
            const d = await resp.json().catch(()=>({}));
            alert('Play failed: ' + (d.error || resp.statusText));
          }
        });
      });
    }

    // deck draw click
    const deckEl = qs('#deck');
    if (deckEl) {
      deckEl.addEventListener('click', async () => {
        const resp = await fetch(`/api/game/games/${gameId}/draw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: forUserId })
        });
        if (!resp.ok) {
          const d = await resp.json().catch(()=>({}));
          alert('Draw failed: ' + (d.error || resp.statusText));
        }
      });
    }
  }

  // initial load
  loadState();

})();
