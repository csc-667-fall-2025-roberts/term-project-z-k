const signup = async (username, email, password) => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "username": username,
        "email": email,
        "password": password
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    const res = await fetch("/api/user/", requestOptions)
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

const setError = (message) => {
    const messageDiv = document.querySelector('#error-message');

    messageDiv.innerHTML = message;
    messageDiv.className = "error-message"

    setTimeout(() => {
        messageDiv.innerHTML = '';
        messageDiv.className = "error-message hidden"
    }, 5000)
}

document.querySelector('#signup-button').addEventListener('click', async (e) => {
    e.preventDefault();

    const username = document.querySelector('#username').value;
    const email = document.querySelector('#email').value;
    const password = document.querySelector('#password').value;
    const confirmPassword = document.querySelector('#confirm-password').value;

    if (!email.includes('@') || !email.includes('.')) {
        setError('Invalid email format')
        return;
    }

    if (password !== confirmPassword) {
        setError('Passwords do not match')
        return;
    }

    if (password.length < 8) {
        setError('Password is too short')
        return;
    }

    const newUser = await signup(username, email, password);
    console.log(newUser)
    if (newUser.success == false) {
        setError(newUser.error)
        return;
    }

    window.location.href = '/login';
})