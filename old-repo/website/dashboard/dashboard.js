import { savePort, deletePort } from "./portManagement.js";

window.onload = async function () {
    await validateLogin();

    const startButton = document
        .getElementById("start")
        .addEventListener("click", startVPS);
    const stopButton = document
        .getElementById("stop")
        .addEventListener("click", stopVPS);
    const rebootButton = document
        .getElementById("reboot")
        .addEventListener("click", rebootVPS);
    const logoutButton = document.getElementById("logout");
    logoutButton.onclick = logoutButtonFunc;

    // Fetch the SSH address on page load
    setSSHAddress();

    setContainerStatus(); // Initial fetch of container status
    setInterval(setContainerStatus, 1500); // Update container status every 1.5 seconds

    // Set the port list
    setPortList();
};

function setSSHAddress() {
    const sshAddressSpan = document.getElementById("sshAddress");
    // Fetch the SSH address on page load
    fetch("/containers/address", {
        method: "GET",
        credentials: 'include'   // cookie sent automatically
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                sshAddressSpan.textContent = data.address;
            } else {
                sshAddressSpan.textContent = "Unknown";
            }
        })
        .catch((error) => {
            console.error("Error fetching SSH address:", error);
            sshAddressSpan.textContent = "Unknown";
        });
}

function setContainerStatus() {
    const containerStatusSpan = document.getElementById("containerStatus");

    // Fetch the container status on page load
    fetch("/containers/status", {
        method: "GET",
        credentials: 'include'   // cookie sent automatically
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                containerStatusSpan.textContent = data.status;
            } else {
                containerStatusSpan.textContent = "Unknown";
            }
        })
        .catch((error) => {
            console.error("Error fetching container status:", error);
            containerStatusSpan.textContent = "Unknown";
        });
}

function startVPS() {
    fetch("/containers/start", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: 'include'   // cookie sent automatically
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                alert("VPS started successfully!");
            } else {
                alert("Failed to start VPS: " + data.message);
            }
        })
        .catch((error) => {
            console.error("Error starting VPS:", error);
            alert("Failed to start VPS: " + (error.message || "Unknown error"));
        });
}

function stopVPS() {
    fetch("/containers/stop", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                alert("VPS stopped successfully!");
            } else {
                alert("Failed to stop VPS: " + data.message);
            }
        })
        .catch((error) => {
            console.error("Error stopping VPS:", error);
            alert("Failed to stop VPS: " + (error.message || "Unknown error"));
        });
}

function rebootVPS() {
    fetch("/containers/restart", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: 'include'   // cookie sent automatically
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                alert("VPS rebooted successfully!");
            } else {
                alert("Failed to reboot VPS: " + data.message);
            }
        })
        .catch((error) => {
            console.error("Error rebooting VPS:", error);
            alert(
                "Failed to reboot VPS: " + (error.message || "Unknown error"),
            );
        });
}

function setPortList() {
    fetch("/containers/port/list", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: 'include'   // cookie sent automatically
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                const portList = document.getElementById("ports-list");

                // Clear the list
                portList.innerHTML = "";

                // Add ports
                data.ports.forEach((portEntry) => {
                    portList.appendChild(createPortEntry(portEntry));
                    portList.appendChild(document.createElement("br"));
                });
            }
        })
        .catch((error) => {
            console.error(`An error occurred fetching the ports: ${error}`);
        });

    // Add to the port listening options
    fetch("/containers/port/valid_ports", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: 'include'   // cookie sent automatically
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                const listeningPort = document.getElementById("listening-port");
                for (const port of data.ports) {
                    const option = document.createElement("option");
                    option.textContent = port;
                    listeningPort.appendChild(option);
                }
            }
        })
        .catch((error) => {
            console.error(`Retrieval of valid ports failed: ${error}`);
        });

    // Set button for port submission
    const submitButton = document.getElementById("submit-port");
    submitButton.onclick = async function () {
        const portName = document.getElementById("port-name").value;
        const listeningPort = document.getElementById("listening-port").value;
        const connectPort = document.getElementById("connect-port").value;

        await savePort(portName, listeningPort, connectPort);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setPortList();
    };
}

function createPortEntry(portEntry) {
    // Create the element that will store port info
    const entry = document.createElement("li");
    const divElement = document.createElement("div");
    divElement.classList.add("port-entry");

    // Create port name entry
    const entryName = document.createElement("h3");
    entryName.textContent = portEntry[0];
    divElement.appendChild(entryName);

    divElement.appendChild(document.createElement("br")); // Break the boxes and title apart

    // Create boxes for ports
    const listenHeader = document.createElement("h4");
    listenHeader.textContent = "Listen";
    const listenDropdown = document.createElement("select");
    listenDropdown.value = getPortAddress(portEntry[1]["listen"]);

    // Add options in the dropdown
    fetch("/containers/port/valid_ports", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            credentials: 'include'   // cookie sent automatically
        },
    })
        .then((response) => {
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                data.ports.forEach((port) => {
                    const option = document.createElement("option");
                    option.textContent = port;
                    listenDropdown.appendChild(option);
                });
            }

            // Set the current port
            listenDropdown.value = getPortAddress(portEntry[1]["listen"]);
        })
        .catch((error) => {
            console.error(`Retrieval of valid ports failed: ${error}`);
        });

    divElement.appendChild(listenHeader);
    divElement.appendChild(listenDropdown);

    divElement.appendChild(document.createElement("br")); // Break the boxes apart

    const connectHeader = document.createElement("h4");
    connectHeader.textContent = "Connect";
    const connectTextbox = document.createElement("input");
    connectTextbox.inputMode = "text";
    connectTextbox.value = getPortAddress(portEntry[1]["connect"]);
    divElement.appendChild(connectHeader);
    divElement.appendChild(connectTextbox);

    // Add it to the port entry
    entry.appendChild(divElement);

    // Create Buttons for managing the port
    const saveButton = document.createElement("button");
    saveButton.textContent = "Save";
    saveButton.onclick = async function () {
        await savePort(
            portEntry[0],
            listenDropdown.value,
            connectTextbox.value,
        );
        await new Promise((resolve) => setTimeout(resolve, 100)); // Delay so the info updates correctly
        setPortList(); // Refresh after doing the command
    };
    entry.appendChild(saveButton);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.onclick = async function () {
        await deletePort(portEntry[0]);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Delay so the info updates correctly
        setPortList(); // Refresh after doing the command
    };
    entry.appendChild(deleteButton);

    return entry;
}

function getPortAddress(ipAddress) {
    let port = ipAddress.substring(ipAddress.indexOf(":") + 1); // There's a first ':' after tcp, so we gotta find the second one
    port = port.substring(port.indexOf(":") + 1); // We find the second one here
    return port;
}
