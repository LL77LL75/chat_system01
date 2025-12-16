// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// --- INIT ---
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// --- USER ---
export let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null") || null;
window.currentUser = currentUser;

export function saveUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
    currentUser = user;
    window.currentUser = user;
}

// --- LOGIN ---
export async function normalLogin(username, password) {
    const snap = await get(ref(db, "users/" + username));
    if (!snap.exists()) return alert("User not found");
    const data = snap.val();
    if (data.password !== password) return alert("Wrong password");
    currentUser = { username, ...data };
    saveUser(currentUser);
    push(ref(db, "logins"), { user: username, time: Date.now(), type: "login" });
    window.location.href = "dashboard.html";
}
window.normalLogin = normalLogin;

// --- LOGOUT ---
export function logout() {
    if (currentUser) push(ref(db, "logins"), { user: currentUser.username, time: Date.now(), type: "logout" });
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
}
window.logout = logout;

// --- ACCOUNT POPUP ---
export function openAccountPopup() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    document.getElementById("displayname-input").value = currentUser?.displayName || "";
    popup.style.display = "block";
}
window.openAccountPopup = openAccountPopup;

export function closeAccountPopup() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    popup.style.display = "none";
}
window.closeAccountPopup = closeAccountPopup;

// --- CHANGE DISPLAY NAME ---
export async function changeDisplayName() {
    const newName = document.getElementById("displayname-input").value.trim();
    if (!newName) return alert("Display name cannot be empty");
    await update(ref(db, "users/" + currentUser.username), { displayName: newName });
    currentUser.displayName = newName;
    saveUser(currentUser);
    alert("Display name updated");
}
window.changeDisplayName = changeDisplayName;

// --- CHANGE PASSWORD ---
export async function changePassword() {
    const pw = prompt("Enter new password");
    if (!pw) return;
    await update(ref(db, "users/" + currentUser.username), { password: pw });
    currentUser.password = pw;
    saveUser(currentUser);
    alert("Password updated");
}
window.changePassword = changePassword;

// --- ACTIVE TITLE ---
export async function setActiveTitle() {
    const title = document.getElementById("title-select").value;
    await update(ref(db, "users/" + currentUser.username), { activeTitle: title });
    currentUser.activeTitle = title;
    saveUser(currentUser);
    alert("Title updated");
}
window.setActiveTitle = setActiveTitle;

// --- CREATE NEW ACCOUNT (core+) ---
export async function createNewAccount() {
    if (!currentUser) return alert("Not logged in");
    if (!(currentUser.rank === "core" || currentUser.rank === "pioneer")) return alert("No permission");
    const username = prompt("New username");
    if (!username) return;
    const password = prompt("New password");
    if (!password) return;
    await set(ref(db, "users/" + username), { password, displayName: username, rank: "newbie", credits: 0, activeTitle: "", titles: {} });
    alert("Account created!");
}
window.createNewAccount = createNewAccount;

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
window.loadRooms = loadRooms;

export function loadRoomInfo(room) {
    const panel = document.getElementById("room-info-panel");
    if (!panel) return;

    const usersInsideDiv = document.getElementById("users-inside");
    const bannedDiv = document.getElementById("banned-users");
    const mutedDiv = document.getElementById("muted-users");

    onValue(ref(db, `rooms/${room}/members`), snap => {
        const members = [];
        snap.forEach(s => members.push(s.key));
        usersInsideDiv.innerHTML = `<strong>Users inside:</strong> ${members.join(", ")} <button onclick="joinRoom('${room}')">Join</button>`;
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
window.loadRoomInfo = loadRoomInfo;

// --- JOIN ROOM ---
export function joinRoom(room) {
    if (!currentUser) return alert("Not logged in");
    const user = currentUser.username;
    set(ref(db, `rooms/${room}/members/${user}`), true);
    push(ref(db, `rooms/${room}/messages`), { sender: user, text: `[SYSTEM] ${user} has joined the room.`, time: Date.now(), system: true });
    window.location.href = "chat.html?room=" + room;
}
window.joinRoom = joinRoom;

// --- LEAVE ROOM ---
export function leaveRoom() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (!room) return;
    const u = currentUser.username;
    remove(ref(db, `rooms/${room}/members/${u}`));
    push(ref(db, `rooms/${room}/messages`), { sender: u, text: `[SYSTEM] ${u} has left the room.`, time: Date.now(), system: true });
    window.location.href = "dashboard.html";
}
window.leaveRoom = leaveRoom;

// --- USER LIST POPUP ---
export function openUserList() {
    const popup = document.getElementById("user-list-panel");
    if (!popup) return;
    popup.style.display = "block";
}
window.openUserList = openUserList;

export function closeUserList() {
    const popup = document.getElementById("user-list-panel");
    if (!popup) return;
    popup.style.display = "none";
}
window.closeUserList = closeUserList;
