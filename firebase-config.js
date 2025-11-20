// app.js
import { db, ref, set, get, push, onValue, remove, update } from './firebase-config.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------ Login ------------------------
window.normalLogin = async function(){
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);

    if(!snap.exists()) { alert("User does not exist"); return; }
    const data = snap.val();
    if(data.password !== password) { alert("Wrong password"); return; }

    window.currentUser = { username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    window.location.href = "dashboard.html";
};

// ------------------------ Logout ------------------------
window._LOGOUT = function(){
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

// ------------------------ Account popup ------------------------
window._CHANGE_DISPLAY = async function(){
    const newDisplay = prompt("New display name", currentUser.displayName);
    if(!newDisplay) return;
    currentUser.displayName = newDisplay;
    await set(ref(db, `users/${currentUser.username}/displayName`), newDisplay);
};

window._CHANGE_PASSWORD = async function(){
    const newPass = prompt("New password");
    if(!newPass) return;
    currentUser.password = newPass;
    await set(ref(db, `users/${currentUser.username}/password`), newPass);
};

window._CHANGE_TITLE = async function(title){
    currentUser.equippedTitle = title;
    await set(ref(db, `users/${currentUser.username}/equippedTitle`), title);
};

// ------------------------ Auctions ------------------------
window.startAuction = async function(title,startBid,time){
    const auctionRef = ref(db, `auctions/${Date.now()}`);
    await set(auctionRef, {title, startBid, currentBid:startBid, creator:currentUser.username, end:Date.now() + time*60000});
};

// ------------------------ Shop ------------------------
window.openShop = function(){
    alert("Shop opened (placeholder)");
};

// ------------------------ Messages ------------------------
window.sendMessage = async function(){
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if(!msg) return;

    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, { sender: currentUser.username, message: msg, timestamp: Date.now() });
    input.value="";
};

// ------------------------ Load messages ------------------------
window.loadMessages = function(){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);
    const container = document.getElementById("messages");
    onValue(messagesRef, snapshot=>{
        container.innerHTML="";
        snapshot.forEach(child=>{
            const m = child.val();
            const div = document.createElement("div");
            div.classList.add("message");
            div.textContent = `[${m.sender}]: ${m.message}`;
            container.appendChild(div);
        });
    });
};

// ------------------------ Credits & Rank Promotion ------------------------
async function checkCreditsAndPromote(){
    const userRef = ref(db, `users/${currentUser.username}`);
    const snap = await get(userRef);
    if(!snap.exists()) return;
    const data = snap.val();

    const now = Date.now();
    if(!data.lastCreditCheck) data.lastCreditCheck = now;
    const diff = now - data.lastCreditCheck;

    let addCredit = 0;
    let timeoutMinutes = 0;

    switch(data.rank){
        case "newbie": addCredit = Math.floor(diff/60000); timeoutMinutes = 15; break;
        case "member": addCredit = Math.floor(diff/60000/5); timeoutMinutes = 30; break;
        case "admin": addCredit = Math.floor(diff/60000/15); timeoutMinutes = 120; break;
        case "high": addCredit = Math.floor(diff/60000/20); timeoutMinutes = 300; break;
        case "core": addCredit = Math.floor(diff/60000/45); timeoutMinutes = 0; break;
        default: addCredit = 0;
    }

    data.credits = (data.credits||0) + addCredit;
    data.lastCreditCheck = now;
    await set(userRef, data);

    // Rank up
    if(data.rank==="newbie" && data.credits>=30) data.rank="member";
    if(data.rank==="member" && data.credits>=100) data.rank="admin"; // example thresholds
    if(data.rank==="admin" && data.credits>=300) data.rank="high";
    if(data.rank==="high" && data.credits>=500) data.rank="core";
    await set(userRef, data);
}

// Run every minute
setInterval(checkCreditsAndPromote, 60000);

// ------------------------ Core/Pioneer Create Account ------------------------
window.createUserPrompt = async function(){
    if(!["core","pioneer"].includes(currentUser.rank)) return alert("Insufficient rank");
    const username = prompt("Enter username");
    const password = prompt("Enter password");
    const displayName = prompt("Enter display name");
    if(!username||!password||!displayName) return;
    await set(ref(db, `users/${username}`), { password, displayName, rank:"newbie", credits:0, titles:{"newbie":"newbie"} });
    alert(`Account ${username} created.`);
};

// ------------------------ Init ------------------------
window.addEventListener("load", ()=>{
    if(window.location.pathname.includes("chat.html")) loadMessages();
});
