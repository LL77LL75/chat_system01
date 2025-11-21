import { db } from "./firebase-config.js";
import {
    ref, set, get, update, push, remove, onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

const IS_DASH = location.pathname.includes("dashboard.html");
const IS_CHAT = location.pathname.includes("chat.html");
const IS_INDEX = location.pathname.includes("index.html");

/* LOGIN */
window.normalLogin = async function () {
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value.trim();

    const userRef = ref(db, "users/" + u);
    const snap = await get(userRef);

    if (!snap.exists()) return alert("No such user");
    if (snap.val().password !== p) return alert("Wrong password");

    window.currentUser = snap.val();
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    location.href = "dashboard.html";
};

/* DASHBOARD LOAD */
window.addEventListener("load", () => {
    if (!IS_DASH) return;

    loadRooms();

    const createBtn = document.getElementById("create-account-btn");
    if (["core", "pioneer"].includes(window.currentUser.rank)) {
        createBtn.style.display = "inline-block";
    }
});

/* LOAD ROOMS */
function loadRooms() {
    if (!IS_DASH) return;

    const list = document.getElementById("room-list");
    onValue(ref(db, "rooms"), snap => {
        list.innerHTML = "";

        snap.forEach(child => {
            const code = child.key;
            const btn = document.createElement("button");
            btn.className = "room-btn";
            btn.textContent = code;
            btn.onclick = () => loadRoomInfo(code);
            list.appendChild(btn);
        });
    });
}

/* ROOM INFO PANEL */
async function loadRoomInfo(code) {
    const box = document.getElementById("room-info");
    box.innerHTML = "Loading...";

    const usersSnap = await get(ref(db, "roomUsers/" + code));
    const bannedSnap = await get(ref(db, "banned/" + code));
    const mutedSnap = await get(ref(db, "muted/" + code));

    let html = `<h3>${code}</h3><b>Users:</b><br>`;

    if (usersSnap.exists()) {
        Object.keys(usersSnap.val()).forEach(u => html += "• " + u + "<br>");
    } else html += "None<br>";

    if (["admin","high","core","pioneer"].includes(window.currentUser.rank)) {
        html += "<br><b>Banned:</b><br>";
        if (bannedSnap.exists()) {
            Object.entries(bannedSnap.val()).forEach(([u,v]) => html += `• ${u} (L${v.level}, ${v.scope})<br>`);
        } else html += "None<br>";

        html += "<br><b>Muted:</b><br>";
        if (mutedSnap.exists()) {
            Object.entries(mutedSnap.val()).forEach(([u,v]) => html += `• ${u} (L${v.level}, ${v.scope})<br>`);
        } else html += "None<br>";
    }

    box.innerHTML = html;
}

/* CREATE ROOM */
window.createRoomClick = async () => {
    const code = document.getElementById("room-code-input").value.trim();
    if (!code) return alert("Enter a room code");

    await set(ref(db, "rooms/" + code), {
        createdBy: window.currentUser.username,
        created: Date.now()
    });

    alert("Room created!");
};

/* DELETE ROOM */
window.deleteRoomClick = async () => {
    const code = document.getElementById("room-code-delete").value.trim();
    if (!code) return alert("Enter room code");

    await remove(ref(db, "rooms/" + code));
    alert("Room deleted!");
};

/* ACCOUNT POPUP */
window.openAccountPopup = () => document.getElementById("account-popup").style.display = "flex";
window.closeAccountPopup = () => document.getElementById("account-popup").style.display = "none";

/* CHANGE DISPLAY NAME */
window.changeDisplayName = async () => {
    const d = document.getElementById("display-name-input").value.trim();
    if (!d) return;

    window.currentUser.displayName = d;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    await update(ref(db, "users/" + window.currentUser.username), { displayName: d });

    alert("Updated!");
};

/* CHANGE PASSWORD */
window.changePassword = async () => {
    const p = document.getElementById("password-input").value.trim();
    if (!p) return;

    window.currentUser.password = p;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    await update(ref(db, "users/" + window.currentUser.username), { password: p });

    alert("Password updated");
};

/* CHANGE TITLE */
window.changeTitle = async () => {
    const t = document.getElementById("title-select").value;
    window.currentUser.equippedTitle = t;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    await update(ref(db, "users/" + window.currentUser.username), { equippedTitle: t });

    alert("Equipped!");
};

/* CREATE ACCOUNT POPUP */
window.openCreateAccountPopup = () => document.getElementById("create-account-popup").style.display = "flex";
window.closeCreateAccountPopup = () => document.getElementById("create-account-popup").style.display = "none";

/* CREATE NEW ACCOUNT */
window.createAccount = async () => {
    const u = document.getElementById("new-username").value.trim();
    const p = document.getElementById("new-password").value.trim();
    const r = document.getElementById("new-rank").value;

    if (!u || !p) return alert("Missing fields");

    const userRef = ref(db, "users/" + u);
    const snap = await get(userRef);
    if (snap.exists()) return alert("User already exists");

    await set(userRef, {
        username: u,
        password: p,
        rank: r,
        displayName: u,
        credits: 0,
        titles: [],
        equippedTitle: ""
    });

    alert("Account created!");
    closeCreateAccountPopup();
};

/* GIVE CREDITS EVERY 1 MIN */
setInterval(async () => {
    if (!window.currentUser.username) return;

    const uRef = ref(db, "users/" + window.currentUser.username);
    const snap = await get(uRef);

    await update(uRef, { credits: (snap.val().credits || 0) + 1 });
}, 120000);
loadRoomInfo()