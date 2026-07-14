window.onload = async function() {
    await validateLogin();

    const codeTextBox = document.getElementById('confirm-code');
    const submitButton = document.getElementById('submit');
    const resendButton = document.getElementById('resend');

    submitButton.onclick = async function() {
        const params = new URLSearchParams({
            'code': codeTextBox.value
        });
        const response = await fetch(`/accounts/confirm?${params}`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            credentials: 'include'   // cookie sent automatically
        });

        if (response.ok) {
            alert("Your account has been successfully confirmed");
            window.location.reload(); // Reload the page to redirect the user to the next step *sigh*
        } else {
            const errorData = await response.json();
            alert(`An error occurred confirming your code: ${errorData.detail}`)
        }
    }

    resendButton.onclick = async function() {
        const response = await fetch('/accounts/resend_code', {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            }
        });

        if (response.ok) {
            alert('A code has been resent to your email')
        } else {
            const errorData = await response.json();
            alert(`An error occurred resending your code: ${errorData.detail}`)
        }
    }

    const logoutButton = document.getElementById('logout');
    logoutButton.onclick = logoutButtonFunc
}