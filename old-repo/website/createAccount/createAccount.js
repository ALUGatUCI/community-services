window.onload = function() {
    var username = document.getElementById('username');
    var password = document.getElementById('password');
    var agreeToTOS = document.getElementById('agree');
    var submitButton = document.getElementById('submit');

    submitButton.onclick = async function() {
        if (!agreeToTOS.checked) {
            alert("You must agree to our terms of use to continue");
            return;
        }

        const formData = new URLSearchParams();
        formData.append('username', username.value);
        formData.append('password', password.value);
        const response = await fetch('/accounts/create_account', {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData
        });

        if (response.ok) {
            alert("Your account has been successfully created. Please check your email for a code.");
            window.location.href = 'index.html';
        } else {
            const errorData = await response.json();
            alert(`An error occurred creating your account: ${errorData.detail}`);
        }
    }
}