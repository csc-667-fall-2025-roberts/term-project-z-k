const setUsername = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow",
        // include credentials so session cookie is sent
        credentials: 'same-origin'
    };

    const res = await fetch("/api/user", requestOptions)
    const data = await res.json();

    console.log(res.status)
    console.log(data)

    if (res.status !== 200) {
        return console.error('Failed to load username:', data.error);
    }

    // Expose current user id for UI decisions (e.g. show delete for host)
    window.currentUserId = data.userId;

    const welcomeElement = document.getElementById('welcome');
    welcomeElement.textContent = `Welcome, ${data.username}`;
}

const createGame = async (name, maxPlayers, isPrivate) => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "name": name,
        "maxPlayers": maxPlayers,
        "isPrivate": isPrivate
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    const res = await fetch("/api/game/rooms/", requestOptions)
    const data = await res.json();

    if (res.status !== 201) {
        return {
            success: false,
            error: data.error
        }
    }

    return {
        success: true,
        data
    }
}

const getGames = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };

    const res = await fetch("/api/game/rooms", requestOptions)
    const data = await res.json();

    return data;
}

const setGames = async () => {
        // Use new endpoint that includes waiting and in_progress rooms and joined flag
        const games = await fetch('/api/game/rooms/all').then(r => r.ok ? r.json() : []);

        // Partition into waiting and in_progress
        // Treat rooms as in-progress for this user if the room status is 'in_progress' OR the user has marked ready (user_ready)
        const waiting = games.filter(g => g.status === 'waiting' && !g.user_ready);
        const inProgress = games.filter(g => g.status === 'in_progress' || g.user_ready);

        function renderList(list) {
                if (!list || list.length === 0) return `<div class="no-rooms">No rooms</div>`;

                return list.map(game => {
                        const isHost = window.currentUserId && Number(window.currentUserId) === Number(game.host_id);
                        const joined = !!game.joined;
                        const playerCount = game.player_count || 0;
                return `<div id="game-${game.id}" class="game">
                        <div class="game-info">
                            <div class="game-name">${game.name}</div>
                            <div class="game-details">
                                <span class="players">${playerCount}/${game.max_players} players</span>
                                <span class="status">${game.status}${game.user_ready ? ' (You ready)' : ''}</span>
                            </div>
                        </div>
                        <div class="game-actions">
                          ${joined ? `<button class="gradient-button enter-room" data-room-id="${game.id}">Enter</button>` : `<button class="gradient-button join-room" data-room-id="${game.id}">Join</button>`}
                          ${isHost ? `<button class="delete-room red-button" data-room-id="${game.id}">Delete</button>` : ''}
                        </div>
                    </div>`
                }).join('');
        }

        document.querySelector('#games').innerHTML = `
            <div class="rooms-section">
                <h3>Waiting</h3>
                <div class="rooms-list">${renderList(waiting)}</div>
            </div>
            <div class="rooms-section">
                <h3>In Progress</h3>
                <div class="rooms-list">${renderList(inProgress)}</div>
            </div>
        `;
}

    // Filter buttons handler (All / Waiting / In Progress)
    document.querySelector('#filter').addEventListener('click', (e) => {
        const btn = e.target;
        if (!(btn instanceof HTMLElement) || btn.tagName.toLowerCase() !== 'button') return;

        // mark active
        document.querySelectorAll('#filter button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const text = btn.textContent?.trim().toLowerCase();
        const sections = Array.from(document.querySelectorAll('.rooms-section'));
        if (!text) return;

        if (text === 'all') {
            sections.forEach(s => s.style.display = 'block');
        } else if (text === 'waiting') {
            sections.forEach(s => {
                if (s.querySelector('h3')?.textContent?.toLowerCase().includes('waiting')) s.style.display = 'block'; else s.style.display = 'none';
            });
        } else if (text === 'in progress') {
            sections.forEach(s => {
                if (s.querySelector('h3')?.textContent?.toLowerCase().includes('in progress')) s.style.display = 'block'; else s.style.display = 'none';
            });
        }
    });

// Event delegation for join/delete actions
document.querySelector('#games').addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    // Join room
    if (target.matches('.join-room')) {
        const roomId = target.getAttribute('data-room-id');
        if (roomId) {
            window.location.href = `/game/rooms/${roomId}`;
        }
        return;
    }

    // Enter room (already joined) - navigate to game page
    if (target.matches('.enter-room')) {
        const roomId = target.getAttribute('data-room-id');
        if (roomId) window.location.href = `/game/rooms/${roomId}`;
        return;
    }

    // Delete room (host only)
    if (target.matches('.delete-room')) {
        const roomId = target.getAttribute('data-room-id');
        if (!roomId) return;

        const confirmed = confirm('Are you sure you want to delete this room? This cannot be undone.');
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/game/rooms/${roomId}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                // remove from DOM
                const el = document.getElementById(`game-${roomId}`);
                if (el && el.parentNode) el.parentNode.removeChild(el);
            } else {
                const data = await res.json().catch(() => ({}));
                alert('Failed to delete room: ' + (data.error || res.statusText));
            }
        } catch (err) {
            console.error('Delete room error', err);
            alert('Failed to delete room');
        }
    }
    
    // Toggle status (host only)
    if (target.matches('.toggle-status')) {
        const roomId = target.getAttribute('data-room-id');
        const newStatus = target.getAttribute('data-new-status');
        if (!roomId || !newStatus) return;
        try {
            if (newStatus === 'in_progress') {
                // Use the start endpoint so the full game-start flow runs (assign orders, create game)
                const res = await fetch(`/api/game/rooms/${roomId}/start`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (res.ok) {
                    await setGames();
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert('Failed to start game: ' + (data.error || res.statusText));
                }
            } else {
                // Fall back to status toggle (e.g., set to waiting)
                const res = await fetch(`/api/game/rooms/${roomId}/status`, {
                    method: 'PATCH',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });

                if (res.ok) {
                    await setGames();
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert('Failed to change status: ' + (data.error || res.statusText));
                }
            }
        } catch (err) {
            console.error('Toggle status error', err);
            alert('Failed to change status');
        }
        return;
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    await setUsername();
    await setGames();
    // Initialize socket and listen for room changes so lobby refreshes automatically
    try {
        if (typeof io !== 'undefined') {
            const socket = io();
            socket.on('connect', () => {
                // optionally join a lobby namespace or room here
                // console.log('Lobby socket connected');
            });

            socket.on('room:statusChanged', (payload) => {
                // payload may contain { roomId, status }
                setGames();
            });

            socket.on('room:created', () => setGames());
            socket.on('room:deleted', () => setGames());
        }
    } catch (e) {
        console.warn('Socket.io not available on this page', e);
    }
});

// Logout button handler — call server to destroy session then redirect to login
const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/user/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                // Clear chat name locally so other tabs update
                try { localStorage.removeItem('globalChatName_v1'); } catch (e) {}
                try { localStorage.setItem('globalChat:signal', Date.now().toString()); } catch (e) {}
                // Redirect to login page
                window.location.href = '/login';
            } else {
                const data = await res.json().catch(() => ({}));
                console.error('Logout failed:', data.error || res.statusText);
                alert('Logout failed');
            }
        } catch (err) {
            console.error('Logout error:', err);
            alert('Logout error');
        }
    });
}

document.querySelector('#create-room-button').addEventListener('click', async (e) => {
    e.preventDefault();

    try {
        const roomName = document.querySelector('#room-name').value;
        const maxPlayers = document.querySelector('#max-players').value.match(/\d+/)[0];
        const isPrivate = document.querySelector('#private-room').checked;

        const newGame = await createGame(roomName, maxPlayers, isPrivate);
        console.log(newGame)

        if (newGame.success !== true) {
            return;
        }

        console.log('sending to new game room')

        window.location.href = `/game/rooms/${newGame.data.id}`;
    } catch (err) {
        console.log(err)
    }
})