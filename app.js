
import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Account Popup
// ------------------------
window.openAccountPopup = function() {
    const popup = document.getElementById("account-popup");
    if(!popup) return;
    popup.style.display = "block";

    document.getElementById("display-name-input").value = window.currentUser.displayName || "";
    const titleDropdown = document.getElementById("title-dropdown");
    titleDropdown.innerHTML = "";
    if(window.currentUser.titles){
        window.currentUser.titles.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            titleDropdown.appendChild(opt);
        });
    }
};

window.closeAccountPopup = function(){
    const popup = document.getElementById("account-popup");
    if(!popup) return;
    popup.style.display = "none";
};

// ------------------------
// Change Display Name
// ------------------------
window._CHANGE_DISPLAY = async function() {
    const newDisplay = document.getElementById("display-name-input").value.trim();
    if(!newDisplay) return alert("Display name cannot be empty");
    const userRef = ref(db, "users/" + window.currentUser.username);
    await update(userRef, { displayName: newDisplay });
    window.currentUser.displayName = newDisplay;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    alert("Display name updated.");
};

// ------------------------
// Change Password
// ------------------------
window._CHANGE_PASSWORD = async function() {
    const newPass = document.getElementById("password-input").value.trim();
    if(!newPass) return alert("Password cannot be empty");
    const userRef = ref(db, "users/" + window.currentUser.username);
    await update(userRef, { password: newPass });
    alert("Password updated.");
};

// ------------------------
// Change Title
// ------------------------
window._CHANGE_TITLE = async function(){
    const selectedTitle = document.getElementById("title-dropdown").value;
    if(!selectedTitle) return alert("Select a title");
    const userRef = ref(db, "users/" + window.currentUser.username);
    await update(userRef, { equippedTitle: selectedTitle });
    window.currentUser.equippedTitle = selectedTitle;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    alert("Title equipped.");
};

// ------------------------
// Create/Delete Room
// ------------------------
window.createRoom = async function(code){
    if(!code) return;
    const roomRef = ref(db, "rooms/" + code);
    const snap = await get(roomRef);
    if(snap.exists()){
        alert("Room exists");
        return;
    }
    await set(roomRef, { createdBy: window.currentUser.username });
    loadRooms();
};

window.deleteRoom = async function(code){
    if(!code) return;
    const roomRef = ref(db, "rooms/" + code);
    const snap = await get(roomRef);
    if(!snap.exists()) return alert("Room does not exist");
    await set(roomRef, null);
    loadRooms();
};

// ------------------------
// Load Rooms and Room Info
// ------------------------
window.selectedRoom = null;

window.loadRooms = function(){
    const list = document.getElementById("room-list");
    if(!list) return;
    list.innerHTML = "";
    const roomsRef = ref(db, "rooms");
    onValue(roomsRef, snapshot => {
        list.innerHTML = "";
        snapshot.forEach(roomSnap => {
            const code = roomSnap.key;
            const btn = document.createElement("button");
            btn.textContent = code;
            btn.style.margin = "3px";
            btn.onclick = () => selectRoom(code);
            list.appendChild(btn);
        });
    });
};

window.selectRoom = async function(code){
    window.selectedRoom = code;
    const infoPanel = document.getElementById("room-info");
    const joinBtn = document.getElementById("join-room-btn");
    const selRoom = document.getElementById("selected-room");
    if(!infoPanel || !joinBtn || !selRoom) return;
    selRoom.textContent = "Selected: " + code;
    joinBtn.style.display = "inline-block";

    const roomRef = ref(db, "rooms/" + code + "/members");
    const snap = await get(roomRef);
    infoPanel.innerHTML = "<h4>Members:</h4>";
    if(snap.exists()){
        Object.values(snap.val()).forEach(m => {
            const div = document.createElement("div");
            div.textContent = m;
            infoPanel.appendChild(div);
        });
    }
    // Show admin-only info if >= admin
    if(["admin","high","core","pioneer"].includes(window.currentUser.rank)){
        const bannedRef = ref(db, "rooms/" + code + "/bans");
        const mutedRef = ref(db, "rooms/" + code + "/mutes");
        const bannedSnap = await get(bannedRef);
        const mutedSnap = await get(mutedRef);
        if(bannedSnap.exists()){
            const bDiv = document.createElement("div");
            bDiv.innerHTML = "<b>Banned:</b>";
            Object.entries(bannedSnap.val()).forEach(([user, level])=>{
                const d = document.createElement("div");
                d.textContent = `${user} (level ${level})`;
                bDiv.appendChild(d);
            });
            infoPanel.appendChild(bDiv);
        }
        if(mutedSnap.exists()){
            const mDiv = document.createElement("div");
            mDiv.innerHTML = "<b>Muted:</b>";
            Object.entries(mutedSnap.val()).forEach(([user, level])=>{
                const d = document.createElement("div");
                d.textContent = `${user} (level ${level})`;
                mDiv.appendChild(d);
            });
            infoPanel.appendChild(mDiv);
        }
    }
};

// ------------------------
// Join Room
// ------------------------
window.joinRoom = async function(){
    if(!window.selectedRoom) return alert("Select a room first");
    const membersRef = ref(db, `rooms/${window.selectedRoom}/members/${window.currentUser.username}`);
    await set(membersRef, window.currentUser.displayName || window.currentUser.username);
    alert("You joined room: " + window.selectedRoom);
};

window.loadRooms();
