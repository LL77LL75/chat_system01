import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Persist dark mode
if(localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");
window.toggleDarkMode = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

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

// Account popup
window.openAccountPopup = () => document.getElementById("account-popup").style.display="block";
window.closeAccountPopup = () => document.getElementById("account-popup").style.display="none";

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

    // Admin buttons
    const addBtn = document.getElementById("add-room-btn");
    const delBtn = document.getElementById("delete-room-btn");
    if(window.currentUser && window.currentUser.admin){
        addBtn.style.display = "inline-block";
        delBtn.style.display = "inline-block";
        addBtn.onclick = async () => {
            const newRoom = prompt("New room name:");
            if(newRoom) await set(ref(db, `rooms/${newRoom}`), true);
        };
        delBtn.onclick = async () => {
            if(confirm("Delete this room?")){
                await remove(ref(db, `rooms/${room}`));
                await remove(ref(db, `roomMembers/${room}`));
                await remove(ref(db, `messages/${room}`));
                document.getElementById("room-info-panel").style.display="none";
            }
        };
    } else {
        addBtn.style.display = delBtn.style.display = "none";
    }

    // Users inside
    const inside = document.getElementById("users-inside");
    onValue(ref(db, `roomMembers/${room}`), snap => {
        inside.innerHTML = "";
        snap.forEach(s => { const li = document.createElement("li"); li.textContent = s.key; inside.appendChild(li); });
    });

    // Banned
    const banned = document.getElementById("users-banned");
    onValue(ref(db, `roomBans/${room}`), snap => {
        banned.innerHTML = "";
        snap.forEach(s => { const li = document.createElement("li"); li.textContent = s.key; banned.appendChild(li); });
    });

    // Muted
    const muted = document.getElementById("users-muted");
    onValue(ref(db, `roomMutes/${room}`), snap => {
        muted.innerHTML = "";
        snap.forEach(s => { const li = document.createElement("li"); li.textContent = s.key; muted.appendChild(li); });
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
