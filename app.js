import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Login / Logout
window.normalLogin = async (username, password) => {
    const snap = await get(ref(db, `users/${username}`));
    if (!snap.exists()) return alert("User not found");
    const u = snap.val();
    if (u.password !== password) return alert("Wrong password");
    window.currentUser = { username, ...u };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    location.href = "dashboard.html";
};
window.logout = () => { localStorage.removeItem("currentUser"); location.href="index.html"; };

// Dark mode
window.toggleDarkMode = () => document.body.classList.toggle("dark");

// Account popup
window.openAccountPopup = () => {
    const p = document.getElementById("account-popup");
    if (!p || !window.currentUser) return;
    document.getElementById("displayname-input").value = window.currentUser.displayName || "";
    p.style.display = "block";
};
window.closeAccountPopup = () => { const p=document.getElementById("account-popup"); if(p)p.style.display="none"; };

// Change display name / password
window.changeDisplayName = async () => {
    const name = document.getElementById("displayname-input").value.trim();
    if(!name || !window.currentUser) return;
    await update(ref(db, `users/${window.currentUser.username}`), { displayName: name });
    window.currentUser.displayName = name;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};
window.changePassword = async () => {
    const pw = prompt("Enter new password:");
    if(!pw || !window.currentUser) return;
    await update(ref(db, `users/${window.currentUser.username}`), { password: pw });
    window.currentUser.password = pw;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

// Load rooms
window.loadRooms = () => {
    const list = document.getElementById("room-list");
    if (!list) return;
    onValue(ref(db, "rooms"), snap => {
        list.innerHTML = "";
        snap.forEach(r => {
            const btn = document.createElement("button");
            btn.textContent = r.key;
            btn.onclick = () => loadRoomInfo(r.key);
            list.appendChild(btn);
        });
    });
};

// Load room info panel
window.loadRoomInfo = async (room) => {
    document.getElementById("current-room-title").textContent = "Room: " + room;

    // Inside
    const inside = document.getElementById("users-inside");
    onValue(ref(db, `roomMembers/${room}`), snap => {
        inside.innerHTML = "";
        snap.forEach(s => { const li = document.createElement("li"); li.textContent = s.key; inside.appendChild(li); });
    });

    // Banned
    const banned = document.getElementById("users-banned");
    onValue(ref(db, `roomBans/${room}`), snap => {
        banned.innerHTML = "";
        snap.forEach(s => { const li = document.createElement("li"); li.textContent = s.key; if(s.val().global) li.style.color="grey"; banned.appendChild(li); });
    });

    // Muted
    const muted = document.getElementById("users-muted");
    onValue(ref(db, `roomMutes/${room}`), snap => {
        muted.innerHTML = "";
        snap.forEach(s => { const li = document.createElement("li"); li.textContent = s.key; if(s.val().global) li.style.color="grey"; muted.appendChild(li); });
    });

    // Join button
    document.getElementById("join-room-btn").onclick = () => {
        if (!window.currentUser) return alert("Not logged in");
        const user = window.currentUser.username;
        set(ref(db, `roomMembers/${room}/${user}`), true);
        push(ref(db, `messages/${room}`), { text:`[SYSTEM] ${user} has joined.`, system:true, time:Date.now() });
        location.href = "chat.html?room=" + room;
    };
};
