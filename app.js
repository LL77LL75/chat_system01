// app.js
// Main logic for login, dashboard, chat, commands, credits, rank system,
// auctions, titles, and Firebase Realtime Database communication.

import { db } from "./firebase-config.js";
import { 
    ref, get, set, update, onValue, push, remove 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

/* ------------------------------
   GLOBAL VARIABLES
------------------------------ */
window.currentUser = null;
window.currentRoom = null;
window.lastActive = Date.now();
window.creditInterval = null;

/* ------------------------------
   RANKS & TITLES
------------------------------ */
const RANKS = ["newbie", "member", "admin", "high", "core", "pioneer"];

const TITLES_BY_RANK = {
    newbie: ["newbie", "newcomer"],
    member: ["member", "long-time newbie"],
    admin: ["official", "trusty person"],
    high: ["powerful", "trusted person"],
    core: ["godly power"],
    pioneer: ["pioneer", "founder"]
};

/* ------------------------------
   LOGIN HANDLER
------------------------------ */
window.normalLogin = async function () {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);

    if (!snap.exists()) {
        alert("User does not exist or not approved yet.");
        return;
    }

    const data = snap.val();
    if (data.password !== password) {
        alert("Wrong password");
        return;
    }

    window.currentUser = { username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    window.location.href = "dashboard.html";
};

/* ------------------------------
   PIONEER / CORE CONSOLE LOGIN
------------------------------ */
window.consoleLogin = async function(user, pass) {
    const userRef = ref(db, "users/" + user);
    const snap = await get(userRef);

    if (!snap.exists()) {
        console.log("Invalid user.");
        return;
    }

    const data = snap.val();
    if (data.password !== pass) {
        console.log("Wrong password.");
        return;
    }

    if (data.rank !== "core" && data.rank !== "pioneer") {
        console.log("Console login only allowed for core/pioneer.");
        return;
    }

    window.currentUser = { username: user, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    console.log("Login successful as " + user + ". Redirecting...");
    window.location.href = "dashboard.html";
};

/* ------------------------------
   TEMPORARY PIONEER TEST ACCOUNT
------------------------------ */
window.createPioneerTest = async function () {
    const testRef = ref(db, "users/LL77LL75");
    await set(testRef, {
        password: "LL77LL75",
        rank: "pioneer",
        status: "normal",
        credits: 0,
        titles: TITLES_BY_RANK["pioneer"]
    });
    alert("Pioneer test account created.");
};

/* ------------------------------
   LOAD CURRENT USER
------------------------------ */
window.loadUser = function () {
    const saved = localStorage.getItem("currentUser");
    if (saved) window.currentUser = JSON.parse(saved);
};

/* ------------------------------
   CREDIT SYSTEM
------------------------------ */
function creditsPerRank(rank) {
    switch(rank) {
        case "newbie": return 15;
        case "member": return 20;
        case "admin": return 25;
        case "high": return 30;
        case "core": return -1;
        case "pioneer": return -1;
        default: return -1;
    }
}

function startCreditTimer() {
    if (!window.currentUser) return;

    const interval = creditsPerRank(window.currentUser.rank);
    if (interval === -1) return;

    window.creditInterval = setInterval(async () => {
        const now = Date.now();
        if (now - window.lastActive > 1.5*60*60*1000) {
            window.currentUser.credits = Math.max(0, window.currentUser.credits-1);
        } else {
            window.currentUser.credits++;
        }
        await update(ref(db, "users/" + window.currentUser.username), {
            credits: window.currentUser.credits
        });
    }, interval * 60 * 1000);
}

window.userActive = function () {
    window.lastActive = Date.now();
};

/* ------------------------------
   ROOM FUNCTIONS
------------------------------ */
window.createRoom = async function(roomCode) {
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);

    if (snap.exists()) {
        alert("Room exists. Joining it.");
        joinRoom(roomCode);
        return;
    }

    await set(roomRef, {
        users: {},
        messages: {},
        auctions: {}
    });

    alert("Room created.");
    joinRoom(roomCode);
};

window.joinRoom = async function(roomCode) {
    window.currentRoom = roomCode;
    localStorage.setItem("currentRoom", roomCode);

    const userRef = ref(db, `rooms/${roomCode}/users/${window.currentUser.username}`);
    await set(userRef, {
        rank: window.currentUser.rank,
        joined: Date.now()
    });

    window.location.href = "chat.html";
};

window.leaveRoom = async function() {
    if (!window.currentRoom || !window.currentUser) return;

    const userRef = ref(db, `rooms/${window.currentRoom}/users/${window.currentUser.username}`);
    await remove(userRef);

    localStorage.removeItem("currentRoom");
    window.location.href = "dashboard.html";
};

window.deleteRoom = async function(roomCode) {
    if (!["admin","high","core","pioneer"].includes(window.currentUser.rank)) {
        alert("Not allowed.");
        return;
    }
    await remove(ref(db, "rooms/" + roomCode));
    alert("Room deleted.");
};

/* ------------------------------
   CHAT FUNCTIONS
------------------------------ */
window.sendMessage = async function() {
    const msgInput = document.getElementById("message-input");
    const msg = msgInput.value.trim();
    if (msg.length === 0) return;

    if (msg.startsWith("?/")) {
        handleCommand(msg);
        msgInput.value = "";
        return;
    }

    const msgRef = ref(db, `rooms/${window.currentRoom}/messages`);
    const newMsg = push(msgRef);

    await set(newMsg, {
        sender: window.currentUser.username,
        text: msg,
        time: Date.now(),
        edited: false
    });

    msgInput.value = "";
};

window.listenToMessages = function() {
    if (!window.currentRoom) return;
    const msgRef = ref(db, `rooms/${window.currentRoom}/messages`);
    const container = document.getElementById("messages");

    onValue(msgRef, snap => {
        container.innerHTML = "";
        snap.forEach(child => {
            const m = child.val();
            const div = document.createElement("div");
            div.textContent = `${m.sender}: ${m.text}${m.edited ? " (edited)" : ""}`;
            container.appendChild(div);
        });
    });
};

/* ------------------------------
   COMMAND SYSTEM
------------------------------ */
window.handleCommand = async function(cmdStr) {
    const parts = cmdStr.split(" ");
    const base = parts[0];

    if (base === "?/give") {
        const target = parts[1];
        const value = parts[2];
        const type = parts[3];
        await giveCommand(target, value, type, parts.slice(4).join(" "));
        return;
    }

    if (base === "?/auction") {
        const item = parts[1];
        const price = parseInt(parts[2]);
        await startAuction(item, price);
        return;
    }

    if (base === "?/rank") {
        const name = parts[1];
        const rank = parts[2];
        await rankUser(name, rank);
        return;
    }

    console.log("Unknown command.");
};

/* ------------------------------
   GIVE COMMAND
------------------------------ */
async function giveCommand(target, value, type, extra) {
    const tRef = ref(db, "users/" + target);
    const snap = await get(tRef);
    if (!snap.exists()) { console.log("User not found."); return; }
    const data = snap.val();

    if (type === "credits") {
        const amount = parseInt(value);
        update(tRef, { credits: (data.credits||0) + amount });
        console.log("Credits given.");
    }

    if (type === "title") {
        const titleName = extra.replace(/'/g,"");
        const titles = data.titles||[];
        titles.push(titleName);
        update(tRef, { titles });
        console.log("Title added.");
    }
}

/* ------------------------------
   AUCTION COMMAND
------------------------------ */
async function startAuction(item, price) {
    if (!window.currentRoom) return;
    const aucRef = ref(db, `rooms/${window.currentRoom}/auctions`);
    const newAuc = push(aucRef);

    await set(newAuc, {
        item,
        price,
        highestBidder: null,
        active: true,
        startTime: Date.now()
    });

    console.log("Auction started for:", item);
}

/* ------------------------------
   RANK COMMAND (Only Pioneer)
------------------------------ */
async function rankUser(name, newRank) {
    if (window.currentUser.rank !== "pioneer") { console.log("Only pioneers can change ranks."); return; }
    if (!RANKS.includes(newRank)) { console.log("Invalid rank."); return; }

    const userRef = ref(db, "users/" + name);
    const snap = await get(userRef);
    if (!snap.exists()) { console.log("User not found."); return; }

    await update(userRef, { rank: newRank, titles: TITLES_BY_RANK[newRank] });
    console.log("Rank updated.");
}

/* ------------------------------
   LOGOUT
------------------------------ */
window.logout = function() {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentRoom");
    window.location.href = "index.html";
};
