import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// -------------------- Global --------------------
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// -------------------- Login / Logout --------------------
window._LOGIN = async function(){
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

window._LOGOUT = function(){
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

// -------------------- Core / Pioneer Account Creation --------------------
window._CREATE_USER = async function(){
    const uname = prompt("Enter username:");
    const pwd = prompt("Enter password:");
    if (!uname || !pwd) return;
    const displayName = uname; // default displayName = username
    const userRef = ref(db, "users/" + uname);
    const snap = await get(userRef);
    if (snap.exists()) { alert("User exists!"); return; }

    await set(userRef, {
        password: pwd,
        rank: "newbie",
        displayName: displayName,
        credits: 0,
        titles: ["newbie","newcomer"]
    });
    alert(`User ${uname} created.`);
};

// -------------------- Account Popup --------------------
window._accPop = function(){
    const newDisplayName = prompt("Change display name:", window.currentUser.displayName);
    if (newDisplayName) {
        window.currentUser.displayName = newDisplayName;
        const userRef = ref(db, "users/" + window.currentUser.username);
        update(userRef, { displayName: newDisplayName });
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        alert("Display name updated.");
    }
    const newPwd = prompt("Change password (leave blank to skip):","");
    if (newPwd) {
        window.currentUser.password = newPwd;
        const userRef = ref(db, "users/" + window.currentUser.username);
        update(userRef, { password: newPwd });
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        alert("Password updated.");
    }
};

// -------------------- Credits System --------------------
const rankCredit = {
    newbie: {interval: 60000, timeout: 900000, nextRank: {credits:30, rank:"member"}}, // every 1min
};

window.creditCheck = async function(){
    const userRef = ref(db, "users/" + window.currentUser.username);
    const snap = await get(userRef);
    if (!snap.exists()) return;
    const data = snap.val();
    const rData = rankCredit[data.rank];
    if (!rData) return;

    let newCredits = (data.credits || 0) + 1; // 1 credit per interval
    await update(userRef, { credits: newCredits });
    window.currentUser.credits = newCredits;

    // Promote if eligible
    if (rData.nextRank && newCredits >= rData.nextRank.credits){
        await update(userRef, { rank: rData.nextRank.rank });
        window.currentUser.rank = rData.nextRank.rank;
        alert(`Congratulations! You are now ${rData.nextRank.rank}`);
    }
};

// Check credits every 1 min
setInterval(creditCheck, 60000);

// -------------------- Auctions / Titles Shop --------------------
window.startAuction = function(title, startingBid, duration){
    if (!title || !startingBid || !duration) return;
    alert(`Auction started for "${title}" with starting bid ${startingBid} for ${duration} min.`);
    // Placeholder: implement Firebase auction push
};

window.openShop = function(){
    alert("Opening title shop... (placeholder)");
};

// -------------------- Room Join/Leave --------------------
window.joinRoom = async function(user){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;
    const membersRef = ref(db, `rooms/${roomCode}/members/${user.username}`);
    await set(membersRef, {displayName: user.displayName, rank:user.rank});
};

window.leaveRoom = async function(user){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;
    const membersRef = ref(db, `rooms/${roomCode}/members/${user.username}`);
    await set(membersRef, null);
};

// -------------------- Chat Messages --------------------
window.sendMessage = async function(){
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if (!msg) return;
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, {
        sender: window.currentUser.username,
        message: msg,
        timestamp: Date.now()
    });
    input.value="";
};

window.loadMessages = function(){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);
    const messagesDiv = document.getElementById("messages");
    onValue(messagesRef, snapshot => {
        messagesDiv.innerHTML="";
        snapshot.forEach(child=>{
            const m = child.val();
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            msgDiv.textContent = `[${m.sender}]: ${m.message}`;
            messagesDiv.appendChild(msgDiv);
        });
    });
};
