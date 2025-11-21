import { db } from "./firebase-config.js";
import {
    ref, set, get, push, onValue, update, remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

/* ---------------- LOGIN ---------------- */
window.normalLogin = async function () {
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value.trim();

    const userRef = ref(db, "users/" + u);
    const snap = await get(userRef);

    if (!snap.exists()) return alert("User does not exist.");
    const data = snap.val();

    if (data.password !== p) return alert("Wrong password");

    window.currentUser = { username: u, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    window.location.href = "dashboard.html";
};

/* ---------------- LOAD ROOMS ---------------- */
window.addEventListener("load", async () => {
    if (!window.location.pathname.includes("dashboard.html")) return;

    const list = document.getElementById("room-list");
    const roomsRef = ref(db, "rooms");

    onValue(roomsRef, (snap) => {
        list.innerHTML = "";
        snap.forEach((child) => {
            const r = child.key;
            const btn = document.createElement("button");
            btn.className = "room-btn";
            btn.textContent = r;
            btn.onclick = () => {
                window.location.href = "chat.html?room=" + r;
            };
            list.appendChild(btn);
        });
    });
});

/* ---------------- CREATE ROOM ---------------- */
window.createRoom = async function (code) {
    if (!code) return;
    const refR = ref(db, "rooms/" + code);
    const s = await get(refR);
    if (s.exists()) return alert("Room already exists.");

    await set(refR, { createdBy: window.currentUser.username, created: Date.now() });
};

/* ---------------- DELETE ROOM ---------------- */
window.deleteRoom = async function (code) {
    if (!code) return;
    const refR = ref(db, "rooms/" + code);
    await remove(refR);
};

/* ---------------- CHAT MESSAGES ---------------- */
window.sendMessage = async function () {
    const t = document.getElementById("message-input");
    const msg = t.value.trim();
    if (!msg) return;

    const room = new URLSearchParams(window.location.search).get("room");
    const msgRef = ref(db, "messages/" + room);

    await push(msgRef, {
        sender: window.currentUser.username,
        displayName: window.currentUser.displayName || window.currentUser.username,
        message: msg,
        reactions: {},
        timestamp: Date.now()
    });

    t.value = "";
};

/* ---------------- LOAD MESSAGES ---------------- */
window.loadMessages = function () {
    const room = new URLSearchParams(window.location.search).get("room");
    const msgRef = ref(db, "messages/" + room);
    const box = document.getElementById("messages");

    onValue(msgRef, (snap) => {
        box.innerHTML = "";
        snap.forEach((child) => {
            const m = child.val();
            const d = document.createElement("div");
            d.className = "message";

            d.innerHTML =
                `<b>${m.displayName}</b>: ${m.message}
                 <small>${new Date(m.timestamp).toLocaleTimeString()}</small>`;

            if (m.reactions) {
                const rDiv = document.createElement("div");
                rDiv.className = "reaction-box";
                for (const [u, r] of Object.entries(m.reactions)) {
                    const s = document.createElement("span");
                    s.textContent = `${u}: ${r}`;
                    rDiv.appendChild(s);
                }
                d.appendChild(rDiv);
            }

            d.onclick = async () => {
                const r = prompt("Enter reaction:");
                if (!r) return;
                m.reactions = m.reactions || {};
                m.reactions[window.currentUser.username] = r;

                await update(ref(db, `messages/${room}/${child.key}`), {
                    reactions: m.reactions
                });
            };

            box.appendChild(d);
        });
    });
};

/* ---------------- ACCOUNT POPUP ---------------- */
window.openAccountPopup = function () {
    const p = document.getElementById("account-popup");
    p.style.display = "flex";

    document.getElementById("display-name-input").value = window.currentUser.displayName || "";

    const sel = document.getElementById("title-select");
    sel.innerHTML = "";
    (window.currentUser.titles || []).forEach(t => {
        const o = document.createElement("option");
        o.value = t;
        o.textContent = t;
        if (t === window.currentUser.equippedTitle) o.selected = true;
        sel.appendChild(o);
    });
};

window.closeAccountPopup = function () {
    document.getElementById("account-popup").style.display = "none";
};

window.changeDisplayName = async function () {
    const n = document.getElementById("display-name-input").value.trim();
    if (!n) return alert("Cannot be empty");

    window.currentUser.displayName = n;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    await update(ref(db, "users/" + window.currentUser.username), {
        displayName: n
    });
};

window.changePassword = async function () {
    const p = document.getElementById("password-input").value.trim();
    if (!p) return alert("Cannot be empty");

    window.currentUser.password = p;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    await update(ref(db, "users/" + window.currentUser.username), {
        password: p
    });
};

window.changeTitle = async function () {
    const t = document.getElementById("title-select").value;

    window.currentUser.equippedTitle = t;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    await update(ref(db, "users/" + window.currentUser.username), {
        equippedTitle: t
    });
};

window.logout = function () {
    localStorage.removeItem("currentUser");
};

/* ---------------- CREDIT SYSTEM (every 1 min) ---------------- */
setInterval(async () => {
    if (!window.currentUser.username) return;

    const uRef = ref(db, "users/" + window.currentUser.username);
    const s = await get(uRef);
    if (!s.exists()) return;

    const d = s.val();
    const r = d.rank;

    let amount = 0;
    if (r === "newbie") amount = 1;
    await update(uRef, { credits: (d.credits || 0) + amount });

}, 60000);
