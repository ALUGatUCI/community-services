window.onload = function () {
  fetch('/accounts/verify_token', {
      method: 'GET',
      credentials: 'include'   // cookie sent automatically
  }).then(response => {
      if (response.ok) {
          redirectToDashboard();
      }
  });
  loginButton.addEventListener('click', login);
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Send the login request to the server
    const data = await fetch(`/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        credentials: 'include'
    })

    if (data.ok) {
        // Redirect to the dashboard or another page
        redirectToDashboard();
    } else {
        alert('Login failed: ' + (data.statusText || 'Unknown error'));
    }
}