
(function () {
  const STORAGE_KEY = 'globalChatMessages_v1';
  const NAME_KEY = 'globalChatName_v1';
  const POS_KEY = 'globalChatPosition_v1';

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadMessages() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveMessages(msgs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  }

  function loadPosition() {
    try {
      return JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function savePosition(pos) {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  }

  async function getName() {
    try {
      const resp = await fetch('/api/user', { credentials: 'same-origin' });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.username) {
          localStorage.setItem(NAME_KEY, data.username);
          return data.username;
        }
      }
    } catch (e) {}
    return localStorage.getItem(NAME_KEY) || 'Guest';
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function render(container, msgs, currentUser) {
    const list = container.querySelector('.chat-messages');
    
    if (msgs.length === 0) {
      list.innerHTML = `<div class="chat-empty">
        <span class="chat-empty-icon">💬</span>
        <span>No messages yet</span>
        <span style="font-size: 0.8rem; opacity: 0.7">Start the conversation!</span>
      </div>`;
      return;
    }

    list.innerHTML = msgs.map(m => {
      const isOwn = m.name === currentUser;
      const ownClass = isOwn ? 'own-message' : '';
      return `<div class="chat-message ${ownClass}">
        <div class="chat-meta">
          <span class="chat-name">${escapeHtml(m.name)}</span>
          <span class="chat-time">${formatTime(m.ts)}</span>
        </div>
        <span class="chat-body">${escapeHtml(m.text)}</span>
      </div>`;
    }).join('');
    
    list.scrollTop = list.scrollHeight;
  }

  function createUI() {
    if (document.getElementById('global-chat')) return null;

    const container = document.createElement('div');
    container.id = 'global-chat';
    container.className = 'chat-open';
    container.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-title">
          <span class="chat-icon">💬</span>
          <span>Chat</span>
          <span class="chat-online"></span>
          <span class="chat-user"></span>
          <span class="chat-room-mode" style="display:none">ROOM</span>
        </div>
        <div class="chat-controls">
          <button class="chat-toggle" title="Minimize">─</button>
          <button class="chat-clear" title="Clear chat">🗑</button>
        </div>
      </div>
      <div class="chat-messages" aria-live="polite"></div>
      <div class="chat-input">
        <input type="text" class="chat-text" placeholder="Type a message..." maxlength="500" />
        <button class="chat-send">Send</button>
      </div>
      <div class="chat-resize-handle"></div>
    `;

    document.body.appendChild(container);
    
    // Restore position
    const savedPos = loadPosition();
    if (savedPos) {
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = savedPos.left + 'px';
      container.style.top = savedPos.top + 'px';
      if (savedPos.width) container.style.width = savedPos.width + 'px';
      if (savedPos.height) container.style.height = savedPos.height + 'px';
    }

    return container;
  }

  function setupDragging(container) {
    const header = container.querySelector('.chat-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.chat-controls')) return;
      
      isDragging = true;
      container.classList.add('chat-dragging');
      
      const rect = container.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      
      // Switch from right/bottom to left/top positioning
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = startLeft + 'px';
      container.style.top = startTop + 'px';
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      // Keep within viewport
      const rect = container.getBoundingClientRect();
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      
      container.style.left = newLeft + 'px';
      container.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.classList.remove('chat-dragging');
        
        // Save position
        const rect = container.getBoundingClientRect();
        savePosition({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    });

    // Touch support for mobile
    header.addEventListener('touchstart', (e) => {
      if (e.target.closest('.chat-controls')) return;
      
      const touch = e.touches[0];
      isDragging = true;
      
      const rect = container.getBoundingClientRect();
      startX = touch.clientX;
      startY = touch.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      
      container.style.right = 'auto';
      container.style.bottom = 'auto';
      container.style.left = startLeft + 'px';
      container.style.top = startTop + 'px';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      const rect = container.getBoundingClientRect();
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      
      container.style.left = newLeft + 'px';
      container.style.top = newTop + 'px';
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (isDragging) {
        isDragging = false;
        const rect = container.getBoundingClientRect();
        savePosition({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    });

    // Save size on resize
    const resizeObserver = new ResizeObserver(() => {
      if (!isDragging) {
        const rect = container.getBoundingClientRect();
        const pos = loadPosition() || {};
        pos.width = rect.width;
        pos.height = rect.height;
        savePosition(pos);
      }
    });
    resizeObserver.observe(container);
  }

  async function init() {
    const name = await getName();
    const container = createUI();
    if (!container) return;

    setupDragging(container);

    const roomMatch = location.pathname.match(/\/game\/rooms\/(\d+)/);
    const roomId = roomMatch ? parseInt(roomMatch[1]) : null;
    const useServerChat = roomId && typeof window.io === 'function';

    // Update user label
    const userLabel = container.querySelector('.chat-user');
    if (userLabel) userLabel.textContent = `(${name})`;

    if (useServerChat) {
      container.querySelector('.chat-room-mode').style.display = 'inline';
      await setupServerChat(container, roomId, name);
    } else {
      const msgs = loadMessages();
      render(container, msgs, name);
      setupLocalChat(container, name);
    }

    // Setup toggle/minimize
    const toggleBtn = container.querySelector('.chat-toggle');
    toggleBtn.addEventListener('click', () => {
      const isMin = container.classList.contains('chat-min');
      container.classList.toggle('chat-open', isMin);
      container.classList.toggle('chat-min', !isMin);
      toggleBtn.textContent = isMin ? '─' : '+';
      toggleBtn.title = isMin ? 'Minimize' : 'Expand';
    });

    // Click on minimized chat to expand
    container.addEventListener('click', (e) => {
      if (container.classList.contains('chat-min') && !e.target.closest('.chat-controls')) {
        container.classList.remove('chat-min');
        container.classList.add('chat-open');
        toggleBtn.textContent = '─';
      }
    });
  }

  function setupLocalChat(container, name) {
    const input = container.querySelector('.chat-text');
    const sendBtn = container.querySelector('.chat-send');
    const clearBtn = container.querySelector('.chat-clear');

    function postMessage(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      
      const currentName = localStorage.getItem(NAME_KEY) || name || 'Guest';
      const m = { name: currentName, text: trimmed, ts: Date.now() };
      const list = loadMessages();
      list.push(m);
      if (list.length > 200) list.splice(0, list.length - 200);
      saveMessages(list);
      render(container, list, currentName);
      
      try { localStorage.setItem('globalChat:signal', Date.now().toString()); } catch (e) {}
    }

    sendBtn.addEventListener('click', () => {
      postMessage(input.value);
      input.value = '';
      input.focus();
    });

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        postMessage(input.value);
        input.value = '';
      }
    });

    clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all chat messages?')) return;
      saveMessages([]);
      render(container, [], name);
    });

    window.addEventListener('storage', (ev) => {
      if (ev.key === STORAGE_KEY || ev.key === 'globalChat:signal') {
        const currentName = localStorage.getItem(NAME_KEY) || name || 'Guest';
        render(container, loadMessages(), currentName);
      }
    });
  }

  async function setupServerChat(container, roomId, name) {
    const userResp = await fetch('/api/user', { credentials: 'same-origin' }).catch(() => null);
    const userData = userResp && userResp.ok ? await userResp.json() : {};
    const username = userData.username || localStorage.getItem(NAME_KEY) || name || 'Guest';

    const userLabel = container.querySelector('.chat-user');
    if (userLabel) userLabel.textContent = `(${username})`;

    // Hide clear button for server chat
    const clearBtn = container.querySelector('.chat-clear');
    if (clearBtn) clearBtn.style.display = 'none';

    if (typeof window.io !== 'function') {
      const msgs = loadMessages();
      render(container, msgs, username);
      setupLocalChat(container, username);
      return;
    }

    const socket = io();
    socket.emit('joinChat', { roomId });

    // Load existing messages
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, { credentials: 'same-origin' });
      if (res.ok) {
        const rows = await res.json();
        const msgs = rows.map(r => ({ 
          name: r.username || 'Unknown', 
          text: r.message, 
          ts: new Date(r.sent_at).getTime() 
        }));
        render(container, msgs, username);
      }
    } catch (e) {
      console.error('Failed to load messages:', e);
    }

    // Listen for new messages
    socket.on('chat:message', (m) => {
      const listEl = container.querySelector('.chat-messages');
      const emptyEl = listEl.querySelector('.chat-empty');
      if (emptyEl) emptyEl.remove();

      const isOwn = m.username === username;
      const item = document.createElement('div');
      item.className = `chat-message ${isOwn ? 'own-message' : ''}`;
      item.innerHTML = `
        <div class="chat-meta">
          <span class="chat-name">${escapeHtml(m.username || 'Unknown')}</span>
          <span class="chat-time">${formatTime(new Date(m.sent_at).getTime())}</span>
        </div>
        <span class="chat-body">${escapeHtml(m.message)}</span>
      `;
      listEl.appendChild(item);
      listEl.scrollTop = listEl.scrollHeight;

      // Show notification if minimized
      if (container.classList.contains('chat-min') && !isOwn) {
        showNotificationBadge(container);
      }
    });

    // Input handlers
    const input = container.querySelector('.chat-text');
    const sendBtn = container.querySelector('.chat-send');

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      try {
        const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });

        if (!res.ok) {
          if (res.status === 401) {
            showChatError(container, 'Please log in to chat');
          } else {
            const d = await res.json().catch(() => ({}));
            showChatError(container, d.error || 'Failed to send');
          }
        } else {
          input.value = '';
        }
      } catch (e) {
        showChatError(container, 'Network error');
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        sendMessage();
      }
    });

    window.addEventListener('beforeunload', () => {
      try {
        socket.emit('leaveChat', { roomId });
        socket.disconnect();
      } catch (e) {}
    });
  }

  function showNotificationBadge(container) {
    let badge = container.querySelector('.chat-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'chat-badge';
      badge.textContent = '1';
      container.querySelector('.chat-header').appendChild(badge);
    } else {
      const count = parseInt(badge.textContent) || 0;
      badge.textContent = Math.min(count + 1, 99);
    }

    // Remove badge when expanded
    const observer = new MutationObserver(() => {
      if (container.classList.contains('chat-open')) {
        badge.remove();
        observer.disconnect();
      }
    });
    observer.observe(container, { attributes: true, attributeFilter: ['class'] });
  }

  function showChatError(container, message) {
    const listEl = container.querySelector('.chat-messages');
    const errorEl = document.createElement('div');
    errorEl.className = 'chat-message system';
    errorEl.textContent = '⚠️ ' + message;
    listEl.appendChild(errorEl);
    listEl.scrollTop = listEl.scrollHeight;
    
    setTimeout(() => errorEl.remove(), 5000);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
