// app.js — main application logic (complete)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getDatabase, ref, get, set, push, onValue, update, remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// --- INIT FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Make db globally accessible for debugging if needed
window.db = db;

/* ============================================================
   UTIL: USER LOAD / SAVE
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

function saveUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
}

// Global user
window.currentUser = loadUser();

/* ============================================================
   CLEANUP: remove old items older than 15 days
   - messages: messages/{room}/{messageId} (field: time)
   - reactions: reactions/{room}/{messageId}/{reactionId} (field: time)
   - logins: logins/{id} (field: time)
============================================================ */
export async function cleanupOldData() {
    try {
        const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - FIFTEEN_DAYS_MS;

        // 1) Messages
        const messagesSnap = await get(ref(db, "messages"));
        if (messagesSnap.exists()) {
            messagesSnap.forEach((roomSnap) => {
                const roomKey = roomSnap.key;
                roomSnap.forEach((msgSnap) => {
                    const msgKey = msgSnap.key;
                    const m = msgSnap.val() || {};
                    const t = m.time || 0;
                    if (t < cutoff) {
                        remove(ref(db, `messages/${roomKey}/${msgKey}`)).catch(console.warn);
                    }
                });
            });
        }

        // 2) Reactions (structure flexible — we scan multiple nested layers)
        const reactionsSnap = await get(ref(db, "reactions"));
        if (reactionsSnap.exists()) {
            reactionsSnap.forEach((roomSnap) => {
                const roomKey = roomSnap.key;
                roomSnap.forEach((msgSnap) => {
                    const msgKey = msgSnap.key;
                    msgSnap.forEach((reactSnap) => {
                        const reactKey = reactSnap.key;
                        const r = reactSnap.val() || {};
                        const t = r.time || 0;
                        if (t < cutoff) {
                            remove(ref(db, `reactions/${roomKey}/${msgKey}/${reactKey}`)).catch(console.warn);
                        }
                    });
                });
            });
        }

        // 3) Logins (includes both login/logout entries stored under "logins")
        const loginsSnap = await get(ref(db, "logins"));
        if (loginsSnap.exists()) {
            loginsSnap.forEach((entrySnap) => {
                const key = entrySnap.key;
                const data = entrySnap.val() || {};
                const t = data.time || 0;
                if (t < cutoff) {
                    remove(ref(db, `logins/${key}`)).catch(console.warn);
                }
            });
        }

        // Also optionally prune old "rooms" and "roomMembers" entries that are empty
        // (not removing rooms themselves; you might want a server-side job for heavy pruning)
    } catch (err) {
        console.error("cleanupOldData error:", err);
    }
}

/* ============================================================
   LOGIN
============================================================ */
export async function normalLogin(username, password) {
    if (!username || !password) return alert("Missing username or password.");

    try {
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

        // Record login
        push(ref(db, "logins"), {
            user: username,
            time: Date.now(),
            type: "login"
        }).catch(console.warn);

        // Run cleanup opportunistically when someone logs in
        cleanupOldData().catch(console.warn);

        window.location.href = "dashboard.html";
    } catch (err) {
        console.error("normalLogin failed", err);
        alert("Login failed. See console for details.");
    }
}

/* ============================================================
   LOGOUT
============================================================ */
export async function logout() {
    try {
        if (window.currentUser) {
            push(ref(db, "logins"), {
                user: window.currentUser.username,
                time: Date.now(),
                type: "logout"
            }).catch(console.warn);
        }

        localStorage.removeItem("currentUser");
        window.currentUser = null;

        // run cleanup
        cleanupOldData().catch(console.warn);

        window.location.href = "index.html";
    } catch (err) {
        console.error("logout failed", err);
    }
}

/* ============================================================
   ROOM PANEL + JOIN ROOM
   - loadRooms() is safe to call only on pages that contain the DOM elements
============================================================ */
export function loadRooms() {
    const list = document.getElementById("room-list");
    const panel = document.getElementById("room-info-panel");

    // If page doesn't have the elements, bail out
    if (!list || !panel) return;

    // Listen for rooms list
    onValue(ref(db, "rooms"), (snap) => {
        // guard again in callback in case DOM changed
        if (!list) return;

        list.innerHTML = "";

        snap.forEach((roomNode) => {
            const room = roomNode.key;

            const btn = document.createElement("button");
            btn.className = "room-btn";
            btn.textContent = room;

            btn.onclick = () => {
                // load room panel (do NOT enter room yet)
                loadRoomInfo(room);
            };

            list.appendChild(btn);
        });
    }, (err) => {
        console.warn("loadRooms onValue error:", err);
    });
}

export function loadRoomInfo(room) {
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
            <button id="join-room-btn">Join Room</button>
        `;

        const joinBtn = document.getElementById("join-room-btn");
        if (joinBtn) {
            joinBtn.onclick = () => joinRoom(room);
        }
    }, (err) => {
        console.warn("loadRoomInfo onValue error:", err);
    });
}

export async function joinRoom(room) {
    if (!window.currentUser) return alert("Not logged in.");
    if (!room) return;

    const user = window.currentUser.username;

    try {
        await set(ref(db, `roomMembers/${room}/${user}`), true);

        // send join message (friendly text, not prefixed with [SYSTEM])
        await push(ref(db, `messages/${room}`), {
            sender: user,
            text: `${user} has joined the chat.`,
            time: Date.now(),
            system: true
        });

        // optional: run cleanup when rooms are joined
        cleanupOldData().catch(console.warn);

        window.location.href = "chat.html?room=" + encodeURIComponent(room);
    } catch (err) {
        console.error("joinRoom failed:", err);
        alert("Failed to join room.");
    }
}

/* ============================================================
   ACCOUNT POPUP
============================================================ */
export function openAccountPopup() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;

    document.getElementById("displayname-input").value =
        window.currentUser?.displayName || "";

    popup.style.display = "block";
}

export function closeAccountPopup() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;

    popup.style.display = "none";
}

/* ============================================================
   CHANGE DISPLAY NAME
============================================================ */
export async function changeDisplayName() {
    const input = document.getElementById("displayname-input");
    if (!input) return alert("Display name input not found.");

    const newName = input.value.trim();
    if (!newName) return alert("Display name cannot be empty.");
    if (!window.currentUser) return alert("Not logged in.");

    const u = window.currentUser.username;

    await update(ref(db, "users/" + u), { displayName: newName });

    window.currentUser.displayName = newName;
    saveUser(window.currentUser);

    alert("Display name updated.");
}

/* ============================================================
   CHANGE PASSWORD
============================================================ */
export async function changePassword() {
    if (!window.currentUser) return alert("Not logged in.");

    const pw = prompt("Enter new password:");
    if (!pw) return;

    const u = window.currentUser.username;

    await update(ref(db, "users/" + u), { password: pw });

    window.currentUser.password = pw;
    saveUser(window.currentUser);

    alert("Password updated.");
}

/* ============================================================
   SET ACTIVE TITLE
============================================================ */
export async function setActiveTitle() {
    if (!window.currentUser) return alert("Not logged in.");

    const sel = document.getElementById("title-select");
    if (!sel) return alert("Title selector not found.");

    const title = sel.value;
    const u = window.currentUser.username;

    await update(ref(db, "users/" + u), { activeTitle: title });

    window.currentUser.activeTitle = title;
    saveUser(window.currentUser);

    alert("Title updated.");
}

/* ============================================================
   CREATE NEW ACCOUNT (CORE + PIONEER)
============================================================ */
export async function createNewAccount() {
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
}

/* ============================================================
   EXPORTS & GLOBALS
   - Export db so other modules (chat.js, dashboard inline) can import it
   - Also attach common functions to window for inline HTML calls
============================================================ */

// Expose to other modules
export { db };

// Attach to window so inline handlers (index.html, dashboard.html) can call them
window.normalLogin = normalLogin;
window.logout = logout;
window.loadRooms = loadRooms;
window.loadRoomInfo = loadRoomInfo;
window.joinRoom = joinRoom;
window.openAccountPopup = openAccountPopup;
window.closeAccountPopup = closeAccountPopup;
window.changeDisplayName = changeDisplayName;
window.changePassword = changePassword;
window.setActiveTitle = setActiveTitle;
window.createNewAccount = createNewAccount;
window.cleanupOldData = cleanupOldData;
