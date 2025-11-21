// app.js
import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ---------------- LOGIN ----------------
export async function normalLogin(username, password) {
    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);
    if (!snap.exists()) return alert("User not found");
    const data = snap.val();
    if (data.password !== password) return alert("Wrong password");

    window.currentUser = { username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    window.location.href = "dashboard.html";
}

// ---------------- DASHBOARD ----------------
export async function loadRooms() {
    const roomsRef = ref(db, 'rooms');
    const snap = await get(roomsRef);
    const list = document.getElementById("room-list");
    list.innerHTML = "";
    if (snap.exists()) {
        Object.keys(snap.val()).forEach(code => {
            const btn = document.createElement("button");
            btn.textContent = code;
            btn.style.marginRight = "5px";
            btn.onclick = () => loadRoomInfo(code);
            list.appendChild(btn);
        });
    }
}

let selectedRoom = null;
export async function loadRoomInfo(code) {
    selectedRoom = code;
    const membersRef = ref(db, `rooms/${code}/members`);
    const snap = await get(membersRef);
    const list = document.getElementById("room-members");
    list.innerHTML = "";
    if (snap.exists()) {
        Object.keys(snap.val()).forEach(name => {
            const li = document.createElement("li");
            li.textContent = name;
            list.appendChild(li);
        });
    }
}

// ---------------- JOIN ROOM ----------------
window.joinRoom = function() {
    if (!selectedRoom) return alert("Select a room first!");
    window.location.href = `chat.html?room=${selectedRoom}`;
};

// ---------------- ACCOUNT POPUP ----------------
export function openAccountPopup() {
    const popup = document.getElementById("account-popup");
    if (!popup) return alert("Account popup container missing");
    popup.style.display = "block";
}

// ---------------- CREATE ACCOUNT ----------------
window.createNewAccount = async function() {
    if (!["core","pioneer"].includes(window.currentUser.rank)) return alert("Unauthorized");
    const username = prompt("Username:"); if(!username) return;
    const password = prompt("Password:"); if(!password) return;
    const displayName = prompt("Display name:"); if(!displayName) return;
    const userRef = ref(db, `users/${username}`);
    if ((await get(userRef)).exists()) return alert("Username exists");
    await set(userRef, {
        password,
        displayName,
        rank: "newbie",
        credits: 0,
        titles: ["newbie","newcomer"],
        lastCredit: Date.now()
    });
    alert("Account created!");
};

// ---------------- LOGOUT ----------------
window.logout = function() {
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};
