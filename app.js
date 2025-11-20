import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Login
// ------------------------
window.normalLogin = async function () {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);

    if (!snap.exists()) { alert("User does not exist."); return; }
    const data = snap.val();
    if (data.password !== password) { alert("Wrong password"); return; }

    window.currentUser = { username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    window.location.href = "dashboard.html";
};

// ------------------------
// Room Management
// ------------------------
window.createRoom = async function(roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (snap.exists()) { alert("Room exists"); return; }
    await set(roomRef, { createdBy: window.currentUser.username, members: [] });
    alert("Room created.");
};

window.deleteRoom = async function(roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (!snap.exists()) { alert("Room does not exist"); return; }
    await remove(roomRef);
    alert("Room deleted.");
};

// ------------------------
// Chat
// ------------------------
window.sendMessage = async function() {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if (!msg) return;

    const roomCode = new URLSearchParams(window.location.search).get("room");
    const msgRef = ref(db, `messages/${roomCode}`);
    await push(msgRef, {
        sender: window.currentUser.username,
        displayName: window.currentUser.displayName || window.currentUser.username,
        message: msg,
        timestamp: Date.now(),
        reactions: {}
    });
    input.value = "";
};

window.loadMessages = function() {
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const msgRef = ref(db, `messages/${roomCode}`);
    const messagesContainer = document.getElementById("messages");

    onValue(msgRef, (snapshot) => {
        messagesContainer.innerHTML = "";
        snapshot.forEach((child) => {
            const m = child.val();
            const div = document.createElement("div");
            div.classList.add("message");
            div.innerHTML = `<b>${m.displayName}:</b> ${m.message} <small>[${new Date(m.timestamp).toLocaleTimeString()}]</small>`;

            if (m.reactions) {
                const rdiv = document.createElement("div");
                rdiv.classList.add("reactions");
                rdiv.style.fontSize = "0.8em";
                for (const [user, reaction] of Object.entries(m.reactions)) {
                    const sp = document.createElement("span");
                    sp.textContent = `${user}: ${reaction} `;
                    rdiv.appendChild(sp);
                }
                div.appendChild(rdiv);
            }

            div.addEventListener("click", async () => {
                if (window.currentUser.rank === "member" || ["admin","high","core","pioneer"].includes(window.currentUser.rank)) {
                    const reaction = prompt("Enter reaction:");
                    if (!reaction) return;
                    m.reactions = m.reactions || {};
                    m.reactions[window.currentUser.username] = reaction;
                    await update(ref(db, `messages/${roomCode}/${child.key}`), { reactions: m.reactions });
                }
            });

            messagesContainer.appendChild(div);
        });
    });
};

// ------------------------
// Account Popup
// ------------------------
window.openAccountPopup = function() {
    document.getElementById("account-popup").style.display = "block";
    const select = document.getElementById("title-select");
    select.innerHTML = "";
    const titles = window.currentUser.titles || [];
    titles.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        if (t === window.currentUser.equippedTitle) opt.selected = true;
        select.appendChild(opt);
    });
    document.getElementById("display-name-input").value = window.currentUser.displayName || "";
};
window.closeAccountPopup = function() { document.getElementById("account-popup").style.display = "none"; };
window.changeDisplayName = async function() {
    const name = document.getElementById("display-name-input").value.trim();
    if (!name) return alert("Cannot be empty");
    window.currentUser.displayName = name;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    await update(ref(db, `users/${window.currentUser.username}`), { displayName: name });
};
window.changePassword = async function() {
    const pass = document.getElementById("password-input").value.trim();
    if (!pass) return alert("Cannot be empty");
    window.currentUser.password = pass;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    await update(ref(db, `users/${window.currentUser.username}`), { password: pass });
};
window.changeTitle = async function() {
    const t = document.getElementById("title-select").value;
    window.currentUser.equippedTitle = t;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    await update(ref(db, `users/${window.currentUser.username}`), { equippedTitle: t });
};
window.logout = function() {
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

// ------------------------
// Credits System (check every 1 min)
// ------------------------
setInterval(async () => {
    const userRef = ref(db, `users/${window.currentUser.username}`);
    const snap = await get(userRef);
    if (!snap.exists()) return;
    const user = snap.val();
    const rank = user.rank;
    let add = 0;
    if (rank === "newbie") add = 1;
    else if (rank === "member") add = 1;
    else if (rank === "admin") add = 1;
    else if (rank === "high") add = 1;
    else if (rank === "core") add = 1;
    else if (rank === "pioneer") add = 0;

    user.credits = (user.credits || 0) + add;
    await update(userRef, { credits: user.credits });
}, 60000);
