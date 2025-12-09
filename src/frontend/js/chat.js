// Client-side persistent chat (no server required)
// Stores messages in localStorage so chat is constant across pages/tabs on the same origin.
(function () {
  const STORAGE_KEY = 'globalChatMessages_v1';
  const NAME_KEY = 'globalChatName_v1';

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadMessages() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '[]';
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveMessages(msgs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  }

  // Try to get username from server session, fall back to localStorage prompt
  async function getName() {
    // check server first
    try {
      const resp = await fetch('/api/user', { credentials: 'same-origin' });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.username) {
          // persist so other pages/tabs use same name
          localStorage.setItem(NAME_KEY, data.username);
          return data.username;
        }
      }
    } catch (e) {
      // ignore network errors and fall back
    }

    // fallback to local storage or prompt
    let name = localStorage.getItem(NAME_KEY);
    if (!name) {
      name = 'Guest';
      localStorage.setItem(NAME_KEY, name);
    }
    return name;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  }

  function render(container, msgs) {
    const list = container.querySelector('.chat-messages');
    list.innerHTML = '';
    msgs.forEach(m => {
      const item = document.createElement('div');
      item.className = 'chat-message';
      item.innerHTML = `<span class="chat-meta">${escapeHtml(m.name)} <small>${formatTime(m.ts)}</small>:</span> <span class="chat-body">${escapeHtml(m.text)}</span>`;
      list.appendChild(item);
    });
    // scroll to bottom
    list.scrollTop = list.scrollHeight;
  }

  function createUI() {
    // Avoid duplicate injection
    if (document.getElementById('global-chat')) return null;

    const container = document.createElement('div');
    container.id = 'global-chat';
    container.className = 'chat-open';
    container.innerHTML = `
      <div class="chat-header">
        <div style="display:flex;align-items:center;gap:8px;"><span>Global Chat</span><span class="chat-user" style="font-weight:400;color:#555;font-size:0.9em"></span></div>
        <div class="chat-controls">
          <button class="chat-change" title="Change name">✎</button>
          <button class="chat-toggle" title="Minimize">−</button>
          <button class="chat-clear" title="Clear messages">🗑</button>
        </div>
      </div>
      <div class="chat-messages" aria-live="polite"></div>
      <div class="chat-input">
        <input type="text" class="chat-text" placeholder="Type a message and press Enter" />
        <button class="chat-send">Send</button>
      </div>
    `;

    document.body.appendChild(container);
    return container;
  }

  async function init() {
    const name = await getName();
    const container = createUI();
    if (!container) return;

    // If on a game room page and socket.io is available, use server-backed chat
    const roomMatch = location.pathname.match(/\/game\/rooms\/(\d+)/);
    const roomId = roomMatch ? parseInt(roomMatch[1]) : null;
    const useServerChat = roomId && typeof window.io === 'function';

    if (useServerChat) {
      // server-backed chat
      await setupServerChat(container, roomId, name);
      return;
    }

    const msgs = loadMessages();
    render(container, msgs);

    const input = container.querySelector('.chat-text');
    const sendBtn = container.querySelector('.chat-send');
    const toggleBtn = container.querySelector('.chat-toggle');
    const clearBtn = container.querySelector('.chat-clear');
  const changeBtn = container.querySelector('.chat-change');
  const userLabel = container.querySelector('.chat-user');

    function postMessage(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      // always read latest name from localStorage in case it changed
      const currentName = localStorage.getItem(NAME_KEY) || name || 'Guest';
      const m = { name: currentName, text: trimmed, ts: Date.now() };
      const list = loadMessages();
      list.push(m);
      // keep last 200 messages
      if (list.length > 200) list.splice(0, list.length - 200);
      saveMessages(list);
      render(container, list);
      // notify other tabs
      try { window.localStorage.setItem('globalChat:signal', Date.now().toString()); } catch (e) {}
    }

    function updateUserLabel() {
      const cur = localStorage.getItem(NAME_KEY) || name || 'Guest';
      if (userLabel) userLabel.textContent = `(${cur})`;
    }

    updateUserLabel();

    changeBtn?.addEventListener('click', () => {
      const cur = localStorage.getItem(NAME_KEY) || name || '';
      const newName = cur || 'Guest';
      localStorage.setItem(NAME_KEY, newName);
      updateUserLabel();
      // notify other tabs
      try { window.localStorage.setItem(NAME_KEY, newName); } catch (e) {}
    });

    sendBtn.addEventListener('click', () => {
      postMessage(input.value);
      input.value = '';
      input.focus();
    });

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        postMessage(input.value);
        input.value = '';
      }
    });

    toggleBtn.addEventListener('click', () => {
      if (container.classList.contains('chat-open')) {
        container.classList.remove('chat-open');
        container.classList.add('chat-min');
        toggleBtn.textContent = '+';
        toggleBtn.title = 'Expand';
      } else {
        container.classList.remove('chat-min');
        container.classList.add('chat-open');
        toggleBtn.textContent = '−';
        toggleBtn.title = 'Minimize';
      }
    });

    clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all chat messages for this browser?')) return;
      saveMessages([]);
      render(container, []);
    });

    // listen for storage signals from other tabs/windows
    window.addEventListener('storage', (ev) => {
      if (ev.key === STORAGE_KEY || ev.key === 'globalChat:signal') {
        const updated = loadMessages();
        render(container, updated);
      }
      if (ev.key === NAME_KEY) {
        // name changed/cleared in another tab — update header label
        updateUserLabel();
      }
    });
  }

  // initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // --- server-backed chat helpers ---
  async function setupServerChat(container, roomId, name) {
    const userResp = await fetch('/api/user', { credentials: 'same-origin' }).catch(()=>null);
    const userData = userResp && userResp.ok ? await userResp.json() : {};
    const username = userData.username || localStorage.getItem(NAME_KEY) || name || 'Guest';

    // show username in header
    const userLabel = container.querySelector('.chat-user');
    if (userLabel) userLabel.textContent = `(${username})`;

    // connect socket
    if (typeof window.io !== 'function') {
      // fallback
      const msgs = loadMessages(); render(container, msgs); return;
    }
    const socket = io();
    socket.emit('joinChat', { roomId });

    // load recent messages from server
    const res = await fetch(`/api/chat/rooms/${roomId}/messages`, { credentials: 'same-origin' });
    if (res.ok) {
      const rows = await res.json();
      // normalize to {name, text, ts}
      const msgs = rows.map(r => ({ name: r.username || 'unknown', text: r.message, ts: new Date(r.sent_at).getTime() }));
      render(container, msgs);
    }

    // listen for incoming messages
    socket.on('chat:message', (m) => {
      const list = loadMessages();
      const entry = { name: m.username || 'unknown', text: m.message, ts: new Date(m.sent_at).getTime() };
      // append to UI directly
      const listEl = container.querySelector('.chat-messages');
      const item = document.createElement('div'); item.className = 'chat-message';
      item.innerHTML = `<span class="chat-meta">${escapeHtml(entry.name)} <small>${formatTime(entry.ts)}</small>:</span> <span class="chat-body">${escapeHtml(entry.text)}</span>`;
      listEl.appendChild(item);
      listEl.scrollTop = listEl.scrollHeight;
    });

    // override postMessage to send to server
    const input = container.querySelector('.chat-text');
    const sendBtn = container.querySelector('.chat-send');

    sendBtn.addEventListener('click', async () => {
      const text = input.value.trim(); if (!text) return;
      const p = await fetch(`/api/chat/rooms/${roomId}/messages`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
      if (!p.ok) {
        if (p.status === 401) {
          alert('You must be logged in to use room chat.');
        } else {
          const d = await p.json().catch(()=>({}));
          alert('Failed to send message: ' + (d.error || p.statusText));
        }
      } else {
        input.value = '';
      }
    });
    input.addEventListener('keydown', async (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); sendBtn.click(); } });

    // cleanup on unload
    window.addEventListener('beforeunload', () => {
      try { socket.emit('leaveChat', { roomId }); socket.disconnect(); } catch (e) {}
    });
  }

})();
