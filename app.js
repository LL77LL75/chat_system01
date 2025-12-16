// app.js — modular, clean version
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, update, remove, query, orderByChild } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// --- INIT FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db; // global for debugging

// --- USER HANDLING ---
export function loadUser() {
    const u = localStorage.getItem("currentUser");
    if (!u) return null;
    try { return JSON.parse(u); } catch { return null; }
}

export function saveUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
}

export let currentUser = loadUser();
window.currentUser = currentUser;

// --- LOGIN ---
export async function normalLogin(username, password) {
    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);
    if (!snap.exists()) return alert("User not found.");
    const data = snap.val();
    if (data.password !== password) return alert("Wrong password.");

    currentUser = { username, ...data };
    saveUser(currentUser);
    window.currentUser = currentUser;

    push(ref(db, "logins"), { user: username, time: Date.now(), type: "login" });
    window.location.href = "dashboard.html";
}

// --- LOGOUT ---
export function logout() {
    if (currentUser) {
        push(ref(db, "logins"), { user: currentUser.username, time: Date.now(), type: "logout" });
    }
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
}

// --- ROOMS ---
export function loadRooms() {
    const list = document.getElementById("room-list");
    const panel = document.getElementById("room-info-panel");
    if (!list || !panel) return;

    onValue(ref(db, "rooms"), snap => {
        list.innerHTML = "";
        snap.forEach(roomNode => {
            const room = roomNode.key;
            const btn = document.createElement("button");
            btn.textContent = room;
            btn.className = "room-btn";
            btn.onclick = () => loadRoomInfo(room);
            list.appendChild(btn);
        });
    });
}

export function loadRoomInfo(room) {
    const panel = document.getElementById("room-info-panel");
    if (!panel) return;

    const usersInsideDiv = document.getElementById("users-inside");
    const bannedDiv = document.getElementById("banned-users");
    const mutedDiv = document.getElementById("muted-users");

    onValue(ref(db, `rooms/${room}/members`), snap => {
        const members = [];
        snap.forEach(s => members.push(s.key));
        usersInsideDiv.innerHTML = `<strong>Users inside:</strong> ${members.join(", ")}`;
    });

    onValue(ref(db, `rooms/${room}/banned`), snap => {
        const banned = [];
        snap.forEach(s => banned.push(s.key));
        bannedDiv.innerHTML = `<strong>Banned Users:</strong> ${banned.map(b => `<span style="color:red">${b}</span>`).join(", ")}`;
    });

    onValue(ref(db, `rooms/${room}/muted`), snap => {
        const muted = [];
        snap.forEach(s => muted.push(s.key));
        mutedDiv.innerHTML = `<strong>Muted Users:</strong> ${muted.map(m => `<span style="color:orange">${m}</span>`).join(", ")}`;
    });
}

// --- ACCOUNT POPUP ---
export function openAccountPopup() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    document.getElementById("displayname-input").value = currentUser?.displayName || "";
    popup.style.display = "block";
}

export function closeAccountPopup() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    popup.style.display = "none";
}

// --- CHANGE DISPLAY NAME ---
export async function changeDisplayName() {
    const newName = document.getElementById("displayname-input").value.trim();
    if (!newName) return alert("Display name cannot be empty.");
    await update(ref(db, "users/" + currentUser.username), { displayName: newName });
    currentUser.displayName = newName;
    saveUser(currentUser);
    alert("Display name updated.");
}

// --- CHANGE PASSWORD ---
export async function changePassword() {
    const pw = prompt("Enter new password:");
    if (!pw) return;
    await update(ref(db, "users/" + currentUser.username), { password: pw });
    currentUser.password = pw;
    saveUser(currentUser);
    alert("Password updated.");
}

// --- ACTIVE TITLE ---
export async function setActiveTitle() {
    const title = document.getElementById("title-select").value;
    await update(ref(db, "users/" + currentUser.username), { activeTitle: title });
    currentUser.activeTitle = title;
    saveUser(currentUser);
    alert("Title updated.");
}

// --- CREATE NEW ACCOUNT (for core+) ---
export async function createNewAccount() {
    if (!currentUser) return alert("Not logged in.");
    const rank = currentUser.rank;
    if (!(rank === "core" || rank === "pioneer")) return alert("No permission.");
    const username = prompt("New username:");
    if (!username) return;
    const password = prompt("New password:");
    if (!password) return;

    await set(ref(db, "users/" + username), {
        password, displayName: username, rank: "newbie", credits: 0, activeTitle: "", titles: {}
    });
    alert("Account created!");
}

// --- EXPORT ---
export { db, currentUser };
