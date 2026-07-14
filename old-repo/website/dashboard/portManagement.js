export async function savePort(portName, listen, connect) {
    const params = new URLSearchParams({
        name: portName,
        listen: listen,
        connect: connect,
    });
    const response = await fetch(`/containers/port/add?${params}`, {
        method: "POST",
        credentials: 'include'   // cookie sent automatically
    });
    const data = await response.json();
    if (data.success) {
        alert("The port has successfully be submitted");
    } else {
        alert(`An issue occurred submitting the port: ${data.detail}`);
    }
}

export async function deletePort(portName) {
    const params = new URLSearchParams({ name: portName });
    const response = await fetch(`/containers/port/delete?${params}`, {
        method: "DELETE",
        credentials: 'include'   // cookie sent automatically
    });
    const data = await response.json();
    if (data.success) {
        alert("The port has successfully be deleted");
    } else {
        alert(`An issue occurred deleting the port: ${data.detail}`);
    }
}
