const setUsername = async () => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };

    const res = await fetch("/api/user", requestOptions)
    const data = await res.json();

    console.log(res.status)
    console.log(data)

    if (res.status !== 200) {
        return console.error('Failed to load username:', data.error);
    }

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
        console.log(game)
        return `<div id="game-${game.id}" class="game">
                    <div class="game-info">
                        <div class="game-name">${game.name}</div>
                        <div class="game-details">
                            <span class="players">1/${game.max_players} players</span>
                            <span class="status">${game.status}</span>
                        </div>
                    </div>
                    <button class="gradient-button">Join</button>
                </div>`
    }).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    setUsername()
    setGames()
});

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