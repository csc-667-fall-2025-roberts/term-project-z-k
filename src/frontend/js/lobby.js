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
    const games = await getGames();

    document.querySelector('#games').innerHTML = games.map(game => {
        const isHost = window.currentUserId && Number(window.currentUserId) === Number(game.host_id);
        return `<div id="game-${game.id}" class="game">
                    <div class="game-info">
                        <div class="game-name">${game.name}</div>
                        <div class="game-details">
                            <span class="players">${game.player_count || 1}/${game.max_players} players</span>
                            <span class="status">${game.status}</span>
                        </div>
                    </div>
                    <div class="game-actions">
                      <button class="gradient-button join-room" data-room-id="${game.id}">Join</button>
                      ${isHost ? `<button class="delete-room red-button" data-room-id="${game.id}">Delete</button>` : ''}
                    </div>
                </div>`
    }).join('');
}

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
});

document.addEventListener('DOMContentLoaded', async () => {
    await setUsername();
    await setGames();
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