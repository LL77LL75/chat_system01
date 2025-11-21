import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// GLOBAL current user
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Core/Pioneer Create Account Button
// ------------------------
window.addEventListener("load", () => {
    if (["core", "pioneer"].includes(window.currentUser.rank)) {
        const container = document.getElementById("create-account-btn-container");
        const btn = document.createElement("button");
        btn.textContent = "Create Account";
        btn.onclick = async () => {
            const username = prompt("Enter username:");
            const password = prompt("Enter password:");
            if (!username || !password) return alert("Invalid username or password.");
            const userRef = ref(db, "users/" + username);
            const snap = await get(userRef);
            if (snap.exists()) return alert("Username already exists!");
            await set(userRef, {
                password,
                rank: "newbie",
                displayName: username,
                titles: ["newbie", "newcomer"],
                credits: 0
            });
            alert("Account created!");
        };
        container.appendChild(btn);
    }
});

// ------------------------
// Load all rooms and create buttons
// ------------------------
let selectedRoomCode = null;

window.loadRoomButtons = async function () {
    const roomListDiv = document.getElementById("room-list");
    roomListDiv.innerHTML = "";

    const roomsSnap = await get(ref(db, "rooms"));
    if (!roomsSnap.exists()) {
        roomListDiv.innerHTML = "No active rooms";
        return;
    }

    Object.keys(roomsSnap.val()).forEach(code => {
        const btn = document.createElement("button");
        btn.textContent = code;
        btn.style.margin = "5px";
        btn.onclick = () => selectRoom(code);
        roomListDiv.appendChild(btn);
    });
};

// Select a room
function selectRoom(code) {
    selectedRoomCode = code;
    loadRoomInfo(code);
}

// Load room info and admin panel
window.loadRoomInfo = async function (code) {
    const box = document.getElementById("room-info");
    const joinBox = document.getElementById("join-container");
    const adminActions = document.getElementById("admin-room-actions");

    box.innerHTML = "Loading...";
    joinBox.innerHTML = "";
    adminActions.innerHTML = "";

    // Load users
    const usersSnap = await get(ref(db, "roomUsers/" + code));
    const bannedSnap = await get(ref(db, "banned/" + code));
    const mutedSnap = await get(ref(db, "muted/" + code));

    let html = `<b>Room: ${code}</b><br><br><b>Users:</b><br>`;

    if (usersSnap.exists()) {
        Object.keys(usersSnap.val()).forEach(user => {
            html += `• ${user}<br>`;
        });
    } else html += "None<br>";

    // Admin-only panels
    if (["admin","high","core","pioneer"].includes(window.currentUser.rank)) {
        html += "<br><b>Banned Users:</b><br>";
        if (bannedSnap.exists()) {
            Object.entries(bannedSnap.val()).forEach(([u,v]) => {
                html += `• ${u} (L${v.level}, ${v.scope})<br>`;
            });
        } else html += "None<br>";

        html += "<br><b>Muted Users:</b><br>";
        if (mutedSnap.exists()) {
            Object.entries(mutedSnap.val()).forEach(([u,v]) => {
                html += `• ${u} (L${v.level}, ${v.scope})<br>`;
            });
        } else html += "None<br>";

        // Admin create/delete buttons
        adminActions.innerHTML =
            `<button onclick="createRoom(prompt('Enter new room code'))">Start Room</button>
             <button onclick="deleteRoom('${code}')">Close Room</button>`;
    }

    box.innerHTML = html;

    // Add the JOIN button
    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Join Room";
    joinBtn.style.padding = "8px 16px";
    joinBtn.style.marginTop = "10px";
    joinBtn.onclick = () => {
        if (!selectedRoomCode) return alert("No room selected!");
        window.location.href = `chat.html?room=${selectedRoomCode}`;
    };
    joinBox.appendChild(joinBtn);
};

// ------------------------
// Room management (admin)
window.createRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (snap.exists()) {
        alert("Room already exists. Redirecting...");
        window.location.href = `chat.html?room=${roomCode}`;
        return;
    }
    await set(roomRef, { createdBy: window.currentUser.username });
    alert("Room created.");
    loadRoomButtons();
};

window.deleteRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (!snap.exists()) {
        alert("Room does not exist.");
        return;
    }
    await set(roomRef, null);
    alert("Room deleted.");
    loadRoomButtons();
};

// Call this once on page load
window.addEventListener("load", () => {
    loadRoomButtons();
});
