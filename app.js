import { db } from "./firebase-config.js";
import {
    ref, set, get, update, push, remove, onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

/* PAGE CHECKERS */
const IS_LOGIN = location.pathname.includes("index.html");
const IS_DASH = location.pathname.includes("dashboard.html");
const IS_CHAT  = location.pathname.includes("chat.html");

/* ---------------- LOGIN ---------------- */
window.normalLogin = async function () {
    const u = document.getElementById("login-username").value.trim();
    const p = document.getElementById("login-password").value.trim();

    const userRef = ref(db, "users/" + u);
    const snap = await get(userRef);

    if (!snap.exists()) return alert("No such user");
    const d = snap.val();

    if (d.password !== p) return alert("Wrong password");

    window.currentUser = { username: u, ...d };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    window.location.href = "dashboard.html";
};

/* ---------------- DASHBOARD LOAD ---------------- */
window.addEventListener("load", () => {
    if (!IS_DASH) return; // FIX #1

    loadRooms();

    const createBtn = document.getElementById("create-account-btn");
    if (createBtn && ["core","pioneer"].includes(window.currentUser.rank)) {
        createBtn.style.display = "block";
    }
});

/* ---------------- LOAD ROOMS ---------------- */
function loadRooms() {
    if (!IS_DASH) return; // FIX #2

    const rList = document.getElementById("room-list");
    const rInfo = document.getElementById("room-info");
    if (!rList) return;

    onValue(ref(db, "rooms"), (snap) => {
        rList.innerHTML = "";
        snap.forEach((child) => {
            const code = child.key;

            const btn = document.createElement("button");
            btn.textContent = code;
            btn.onclick = () => loadRoomInfo(code);

            rList.appendChild(btn);
        });
    });
}

/* ---------------- ROOM INFO PANEL ---------------- */
async function loadRoomInfo(code) {
    if (!IS_DASH) return;
    const roomInfo = document.getElementById("room-info");
    if (!roomInfo) return; // FIX #3

    const usersRef = ref(db, "roomUsers/" + code);
    const bannedRef = ref(db, "banned/" + code);
    const mutedRef = ref(db, "muted/" + code);

    const [uSnap, bSnap, mSnap] = await Promise.all([
        get(usersRef), get(bannedRef), get(mutedRef)
    ]);

    let html = `<h3>Room: ${code}</h3><b>Users:</b><br>`;

    if (uSnap.exists()) {
        Object.keys(uSnap.val()).forEach(u => {
            html += `• ${u}<br>`;
        });
    } else html += "No users<br>";

    if (["admin","high","core","pioneer"].includes(window.currentUser.rank)) {
        html += `<br><b>Banned:</b><br>`;
        if (bSnap.exists()) {
            Object.entries(bSnap.val()).forEach(([u,v])=>{
                html+=`• ${u} (L${v.level}, ${v.scope})<br>`;
            });
        } else html+="None<br>";

        html += `<br><b>Muted:</b><br>`;
        if (mSnap.exists()) {
            Object.entries(mSnap.val()).forEach(([u,v])=>{
                html+=`• ${u} (L${v.level}, ${v.scope})<br>`;
            });
        } else html+="None<br>";
    }

    roomInfo.innerHTML = html;
}

/* ---------------- CREATE & DELETE ROOMS ---------------- */
window.createRoomClick = async function () {
    if (!IS_DASH) return;
    const code = document.getElementById("room-code-input").value.trim();
    if (!code) return;

    await set(ref(db, "rooms/" + code), {
        createdBy: window.currentUser.username,
        created: Date.now()
    });
    alert("Room created");
};

window.deleteRoomClick = async function () {
    if (!IS_DASH) return;
    const code = document.getElementById("room-code-delete").value.trim();
    if (!code) return;

    await remove(ref(db, "rooms/" + code));
    alert("Room deleted");
};

/* ---------------- ACCOUNT POPUP ---------------- */
window.openAccountPopup = function () {
    if (!IS_DASH) return;
    const p = document.getElementById("account-popup");
    if (!p) return;
    p.style.display = "flex";

    document.getElementById("display-name-input").value = window.currentUser.displayName;

    const sel = document.getElementById("title-select");
    if (!sel) return;

    sel.innerHTML = "";
    (window.currentUser.titles || []).forEach(t => {
        const o = document.createElement("option");
        o.value = t; o.textContent = t;
        if (t === window.currentUser.equippedTitle) o.selected = true;
        sel.appendChild(o);
    });
};

window.closeAccountPopup = function () {
    const p = document.getElementById("account-popup");
    if (p) p.style.display = "none";
};

window.changeDisplayName = async function () {
    if (!IS_DASH) return;
    const d = document.getElementById("display-name-input").value.trim();
    if (!d) return;

    window.currentUser.displayName = d;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    await update(ref(db, "users/" + window.currentUser.username), {
        displayName: d
    });
};

window.changePassword = async function () {
    if (!IS_DASH) return;
    const p = document.getElementById("password-input").value.trim();
    if (!p) return;

    window.currentUser.password = p;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    await update(ref(db, "users/" + window.currentUser.username), {
        password: p
    });
};

window.changeTitle = async function () {
    if (!IS_DASH) return;

    const t = document.getElementById("title-select").value;

    window.currentUser.equippedTitle = t;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));

    await update(ref(db, "users/" + window.currentUser.username), {
        equippedTitle: t
    });
};

/* ---------------- CREATE ACCOUNT ---------------- */
window.openCreateAccountPopup = function () {
    if (!IS_DASH) return;
    const p = document.getElementById("create-account-popup");
    if (p) p.style.display = "flex";
};

window.closeCreateAccountPopup = function () {
    const p = document.getElementById("create-account-popup");
    if (p) p.style.display = "none";
};

window.createAccount = async function () {
    if (!IS_DASH) return;

    const u = document.getElementById("new-username").value.trim();
    const p = document.getElementById("new-password").value.trim();
    const r = document.getElementById("new-rank").value;

    if (!u || !p) return alert("Missing fields");

    const refU = ref(db, "users/" + u);
    const snap = await get(refU);
    if (snap.exists()) return alert("User exists");

    await set(refU, {
        username: u,
        password: p,
        displayName: u,
        rank: r,
        credits: 0,
        titles: [],
        equippedTitle: ""
    });

    alert("Account created");
    closeCreateAccountPopup();
};

/* ---------------- CREDITS EVERY 1 MIN ---------------- */
setInterval(async () => {
    if (!window.currentUser.username) return;

    const uRef = ref(db, "users/" + window.currentUser.username);
    const s = await get(uRef);
    if (!s.exists()) return;

    await update(uRef, { credits: (s.val().credits || 0) + 1 });

}, 60000);
