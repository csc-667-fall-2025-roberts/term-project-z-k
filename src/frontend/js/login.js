const login = async (usernameOrEmail, password) => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "usernameOrEmail": usernameOrEmail,
        "password": password
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    const res = await fetch("/api/user/login", requestOptions)
    const data = await res.json();

    if (res.status !== 200) {
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

const setError = (message) => {
    const messageDiv = document.querySelector('#error-message');

    messageDiv.innerHTML = message;
    messageDiv.className = "error-message"

    setTimeout(() => {
        messageDiv.innerHTML = '';
        messageDiv.className = "error-message hidden"
    }, 5000)
}

document.querySelector('#login-button').addEventListener('click', async (e) => {
    e.preventDefault();

    const usernameOrEmail = document.querySelector('#username-or-email').value;
    const password = document.querySelector('#password').value;

    const user = await login(usernameOrEmail, password);
    console.log(user)
    if (user.success == false) {
        setError(user.error)
        return;
    }

    window.location.href = '/lobby';
})