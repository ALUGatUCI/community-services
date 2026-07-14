window.onload = async function() {
    await validateLogin();

    const input = document.getElementById('answer');
    input.addEventListener('input', countChars);

    const submit = document.getElementById('submit');
    submit.addEventListener('click', submitRequest);

    const logoutButton = document.getElementById('logout');
    logoutButton.onclick = logoutButtonFunc
}

function countChars() {
    const input = document.getElementById('answer');
    const charCount = document.getElementById('counter');
    charCount.textContent = `Characters (300 minimum and 1000 maximum): ${input.value.length}`;

    if (input.value.length > 1000 || input.value.length < 300) {
        charCount.style.color = 'red';
    } else {
        charCount.style.color = 'black';
    }
}

async function submitRequest() {
    const answer = document.getElementById('answer').value;
    if (answer.length < 300) {
        alert('Please provide a more detailed answer (at least 300 characters).');
        return;
    } else if (answer.length > 1000) {
        alert('Please provide a more concise answer (at most 1000 characters).');
        return;
    }

    if (confirm("Are you sure you want to submit your application? You will not be able to make any changes once you submit it.")) {
        const request = await fetch('/accounts/request_container', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 'request_body': answer }),
            credentials: 'include'   // cookie sent automatically
        })

        if (request.ok) {
            alert("Your request has been successfully submitted. You will receive an email when we approve your request.")
        } else {
            const errorData = await request.json();
            alert(`An error occurred submitting your request: ${errorData.detail}`)
        }
    }
}