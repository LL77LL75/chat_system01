// app.js — final working version

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
    getDatabase, ref, get, set, push, onValue, update
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import {
    firebaseConfig
} from "./firebase-config.js";

// --- INIT FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Make db globally accessible for debugging
window.db = db;

/* ============================================================
   LOAD CURRENT USER
============================================================ */
function loadUser() {
    let u = localStorage.getItem("currentUser");
    if (!u) return null;
    try {
        return JSON.parse(u);
    } catch {
        return null;
    }
}

// Save user
function saveUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
}

// Global user
window.currentUser = loadUser();

/* ============================================================
   LOGIN
============================================================ */
window.normalLogin = async function (username, password) {
    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);

    if (!snap.exists()) {
        alert("User not found.");
        return;
    }

    const data = snap.val();

    if (data.password !== password) {
        alert("Wrong password.");
        return;
    }

    window.currentUser = { username, ...data };
    saveUser(window.currentUser);

    // Record login (stored for 10 days by clear job)
    push(ref(db, "logins"), {
        user: username,
        time: Date.now(),
        type: "login"
    });

    window.location.href = "dashboard.html";
};

/* ============================================================
   LOGOUT
============================================================ */
window.logout = function () {
    if (window.currentUser) {
        push(ref(db, "logins"), {
            user: window.currentUser.username,
            time: Date.now(),
            type: "logout"
        });
    }

    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

/* ============================================================
   ROOM PANEL + JOIN ROOM
============================================================ */
window.loadRooms = function () {
    const list = document.getElementById("room-list");
    const panel = document.getElementById("room-info-panel");

    if (!list || !panel) return;

    onValue(ref(db, "rooms"), (snap) => {
        list.innerHTML = "";

        snap.forEach((roomNode) => {
            const room = roomNode.key;

            const btn = document.createElement("button");
            btn.className = "room-btn";
            btn.textContent = room;

            btn.onclick = () => {
                // load room panel (do NOT enter room yet)
                window.loadRoomInfo(room);
            };

            list.appendChild(btn);
        });
    });
};

window.loadRoomInfo = function (room) {
    const panel = document.getElementById("room-info-panel");
    if (!panel) return;

    onValue(ref(db, "roomMembers/" + room), (snap) => {
        let members = [];
        snap.forEach((userSnap) => {
            members.push(userSnap.key);
        });

        panel.innerHTML = `
            <h3>Room: ${room}</h3>
            <p>Users inside:</p>
            <ul>${members.map(u => `<li>${u}</li>`).join("")}</ul>
            <button onclick="joinRoom('${room}')">Join Room</button>
        `;
    });
};

window.joinRoom = function (room) {
    if (!window.currentUser) return alert("Not logged in.");

    const user = window.currentUser.username;

    set(ref(db, `roomMembers/${room}/${user}`), true);

    // send join message
    push(ref(db, `messages/${room}`), {
        sender: user,
        text: "[SYSTEM] " + user + " has joined.",
        time: Date.now(),
        system: true
    });

    window.location.href = "chat.html?room=" + room;
};

/* ============================================================
   ACCOUNT POPUP
============================================================ */

window.openAccountPopup = function () {
    const popup = document.getElementById("account-popup");
    if (!popup) return;

    document.getElementById("displayname-input").value =
        window.currentUser?.displayName || "";

    popup.style.display = "block";
};

window.closeAccountPopup = function () {
    const popup = document.getElementById("account-popup");
    if (!popup) return;

    popup.style.display = "none";
};

/* ============================================================
   CHANGE DISPLAY NAME
============================================================ */
window.changeDisplayName = async function () {
    const newName = document.getElementById("displayname-input").value.trim();
    if (!newName) return alert("Display name cannot be empty.");

    const u = window.currentUser.username;

    await update(ref(db, "users/" + u), { displayName: newName });

    window.currentUser.displayName = newName;
    saveUser(window.currentUser);

    alert("Display name updated.");
};

/* ============================================================
   CHANGE PASSWORD
============================================================ */
window.changePassword = async function () {
    const pw = prompt("Enter new password:");
    if (!pw) return;

    const u = window.currentUser.username;

    await update(ref(db, "users/" + u), { password: pw });

    window.currentUser.password = pw;
    saveUser(window.currentUser);

    alert("Password updated.");
};

/* ============================================================
   SET ACTIVE TITLE
============================================================ */
window.setActiveTitle = async function () {
    const title = document.getElementById("title-select").value;
    const u = window.currentUser.username;

    await update(ref(db, "users/" + u), { activeTitle: title });

    window.currentUser.activeTitle = title;
    saveUser(window.currentUser);

    alert("Title updated.");
};

/* ============================================================
   CREATE NEW ACCOUNT (CORE + PIONEER)
============================================================ */
window.createNewAccount = async function () {
    if (!window.currentUser) return alert("Not logged in.");

    const rank = window.currentUser.rank;

    if (!(rank === "core" || rank === "pioneer"))
        return alert("No permission.");

    const username = prompt("New username:");
    if (!username) return;

    const password = prompt("New password:");
    if (!password) return;

    await set(ref(db, "users/" + username), {
        password: password,
        displayName: username,
        rank: "newbie",
        credits: 0,
        activeTitle: "",
        ownedTitles: {}
    });

    alert("Account created!");
};

/* ============================================================
   EXPORTS FOR CHAT.JS
============================================================ */
export { db };
