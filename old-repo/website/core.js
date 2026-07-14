async function validateLogin() {
    const response = await fetch('/accounts/verify_token', {
        method: 'GET',
        credentials: 'include'   // cookie sent automatically
    });

    if (response.status === 401) {
        alert(`error: ${await response.json().detail}`);
        window.location.href = 'index.html';
    } else {
        redirectToDashboard();
    }

    // Load the Ubuntu font from Google Fonts
    const preconnectAPI = document.createElement('link');
    preconnectAPI.rel = 'preconnect';
    preconnectAPI.href = 'https://fonts.googleapis.com';
    preconnectAPI.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectAPI);

    const preconnectFonts = document.createElement('link');
    preconnectFonts.rel = 'preconnect';
    preconnectFonts.href = 'https://fonts.gstatic.com';
    preconnectFonts.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectFonts);

    const font = document.createElement('link');
    font.href = 'https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,500;1,700&display=swap';
    font.rel = 'stylesheet';
    document.head.appendChild(font);
}

async function redirectToDashboard() {
    const apiCall = await fetch('/accounts/account_confirmed', {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: 'include'   // cookie sent automatically
    });
    const result = await apiCall.json();

    if (result.confirmed) {
        const hasContainer = await fetch('/containers/exists', {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: 'include'   // cookie sent automatically
        });
        if (hasContainer.ok) {
            const data = await hasContainer.json();
            if (data.exists) {
                if (!window.location.href.endsWith('dashboard.html')) {
                    window.location.href = 'dashboard.html';
                }
            } else {
                if (!window.location.href.endsWith('request.html')) {
                    window.location.href = 'request.html';
                }
            }
        }
    } else {
        if (!window.location.href.endsWith('confirm.html')) {
            window.location.href = 'confirm.html';
        }
    }
}

// This is for logout buttons
async function logoutButtonFunc() {
    const response = await fetch('/accounts/logout', {
        method: 'POST',
        credentials: 'include'   // cookie sent automatically
    });

    if (response.ok) {
      // Clear the cookie client-side
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = 'index.html';
    } else {
        const errorData = await response.json()
        alert(`An error occurred logging you out: ${errorData.detail}`)
    }
}