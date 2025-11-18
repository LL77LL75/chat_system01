// app.js
// Main logic for login, dashboard, chat, commands, credits, rank system,
// auctions, titles, and Firebase Realtime Database communication.

import { app } from "./firebase-config.js";
import {
    getDatabase,
    ref,
    get,
    set,
    update,
    onValue,
    push,
    remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const db = getDatabase(app);

/* ---------------------------------------------------------
   GLOBALS
--------------------------------------------------------- */
window.currentUser = null;
window.currentRoom = null;
window.lastActive = Date.now();
window.creditInterval = null;

/* ---------------------------------------------------------
   RANK DEFINITIONS
--------------------------------------------------------- */
const RANKS = ["newbie", "member", "admin", "high", "core", "pioneer"];

const TITLES_BY_RANK = {
    newbie: ["newbie", "newcomer"],
    member: ["member", "long-time newbie"],
    admin: ["official", "trusty person"],
    high: ["powerful", "trusted person"],
    core: ["godly power"],
    pioneer: ["pioneer", "founder"] // pioneers can also create custom titles
};

/* ---------------------------------------------------------
   LOGIN HANDLER (for normal users)
--------------------------------------------------------- */
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

    currentUser = { username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    window.location.href = "dashboard.html";
};

/* ---------------------------------------------------------
   SPECIAL CONSOLE LOGIN FOR CORE + PIONEER ON PC
--------------------------------------------------------- */
window.consoleLogin = async function (user, pass) {
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

    currentUser = { username: user, ...data };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    console.log("Login successful as " + user + ". Redirecting...");
    window.location.href = "dashboard.html";
};

/* ---------------------------------------------------------
   TEMPORARY: CREATE PIONEER ACCOUNT
   (Used only once for testing)
--------------------------------------------------------- */
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

/* ---------------------------------------------------------
   LOAD USER ON PAGE OPEN
--------------------------------------------------------- */
window.loadUser = function () {
    const saved = localStorage.getItem("currentUser");
    if (saved) {
        currentUser = JSON.parse(saved);
    }
};

/* ---------------------------------------------------------
   CREDIT SYSTEM
--------------------------------------------------------- */
function creditsPerRank(rank) {
    switch (rank) {
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
    if (!currentUser) return;

    const interval = creditsPerRank(currentUser.rank);
    if (interval === -1) return;

    creditInterval = setInterval(async () => {
        const now = Date.now();
        if (now - lastActive > 1.5 * 60 * 60 * 1000) {
            // user idle too long → remove earned credits
            currentUser.credits = Math.max(0, currentUser.credits - 1);
        } else {
            currentUser.credits++;
        }
        update(ref(db, "users/" + currentUser.username), {
            credits: currentUser.credits
        });
    }, interval * 60 * 1000);
}

window.userActive = function () {
    lastActive = Date.now();
};

/* ---------------------------------------------------------
   ROOM FUNCTIONS
--------------------------------------------------------- */
window.createRoom = async function (roomCode) {
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

window.joinRoom = async function (roomCode) {
    currentRoom = roomCode;
    localStorage.setItem("currentRoom", roomCode);

    const userRef = ref(db, "rooms/" + roomCode + "/users/" + currentUser.username);
    await set(userRef, {
        rank: currentUser.rank,
        joined: Date.now()
    });

    window.location.href = "chat.html";
};

window.leaveRoom = async function () {
    if (!currentRoom || !currentUser) return;

    const userRef = ref(db, "rooms/" + currentRoom + "/users/" + currentUser.username);
    await remove(userRef);

    localStorage.removeItem("currentRoom");
    window.location.href = "dashboard.html";
};

window.deleteRoom = async function (roomCode) {
    if (currentUser.rank !== "admin" &&
        currentUser.rank !== "high" &&
        currentUser.rank !== "core" &&
        currentUser.rank !== "pioneer") {
        alert("Not allowed.");
        return;
    }

    await remove(ref(db, "rooms/" + roomCode));
    alert("Room deleted.");
};

/* ---------------------------------------------------------
   SEND CHAT MESSAGE
--------------------------------------------------------- */
window.sendMessage = async function () {
    const msgInput = document.getElementById("chat-input");
    const msg = msgInput.value.trim();
    if (msg.length === 0) return;

    const isCmd = msg.startsWith("?/");

    if (isCmd) {
        handleCommand(msg);
        msgInput.value = "";
        return;
    }

    const msgRef = ref(db, "rooms/" + currentRoom + "/messages");
    const newMsg = push(msgRef);

    await set(newMsg, {
        sender: currentUser.username,
        text: msg,
        time: Date.now(),
        edited: false
    });

    msgInput.value = "";
};

/* ---------------------------------------------------------
   COMMAND SYSTEM — “?/anything”
--------------------------------------------------------- */
window.handleCommand = async function (cmdStr) {
    const parts = cmdStr.split(" ");
    const base = parts[0];

    // ?/give [name] [number/title] credits/title '[title]'
    if (base === "?/give") {
        const target = parts[1];
        const value = parts[2];
        const type = parts[3];

        await giveCommand(target, value, type, parts.slice(4).join(" "));
        return;
    }

    // ?/auction [title/status/rank] [starting price]
    if (base === "?/auction") {
        const item = parts[1];
        const price = parseInt(parts[2]);
        await startAuction(item, price);
        return;
    }

    // ?/rank [name] [rank] (only pioneer)
    if (base === "?/rank") {
        const name = parts[1];
        const rank = parts[2];
        await rankUser(name, rank);
        return;
    }

    console.log("Unknown command.");
};

/* ---------------------------------------------------------
   COMMAND: GIVE
--------------------------------------------------------- */
async function giveCommand(target, value, type, extra) {
    const tRef = ref(db, "users/" + target);
    const snap = await get(tRef);
    if (!snap.exists()) {
        console.log("User not found.");
        return;
    }

    const data = snap.val();

    if (type === "credits") {
        const amount = parseInt(value);
        update(tRef, { credits: (data.credits || 0) + amount });
        console.log("Credits given.");
    }

    if (type === "title") {
        const titleName = extra.replace(/'/g, "");
        const titles = data.titles || [];
        titles.push(titleName);
        update(tRef, { titles });
        console.log("Title added.");
    }
}

/* ---------------------------------------------------------
   COMMAND: AUCTION
--------------------------------------------------------- */
async function startAuction(item, price) {
    if (!currentRoom) return;

    const aucRef = ref(db, "rooms/" + currentRoom + "/auctions/");
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

/* ---------------------------------------------------------
   COMMAND: RANK (PROMOTE/DEMOTE)
   Only pioneer
--------------------------------------------------------- */
async function rankUser(name, newRank) {
    if (currentUser.rank !== "pioneer") {
        console.log("Only pioneers can change ranks.");
        return;
    }
    if (!RANKS.includes(newRank)) {
        console.log("Invalid rank.");
        return;
    }

    const userRef = ref(db, "users/" + name);
    const snap = await get(userRef);

    if (!snap.exists()) {
        console.log("User not found.");
        return;
    }

    await update(userRef, {
        rank: newRank,
        titles: TITLES_BY_RANK[newRank]
    });

    console.log("Rank updated.");
}

/* ---------------------------------------------------------
   CHAT LISTENER
--------------------------------------------------------- */
window.listenToMessages = function () {
    if (!currentRoom) return;

    const msgRef = ref(db, "rooms/" + currentRoom + "/messages");
    onValue(msgRef, (snap) => {
        const container = document.getElementById("chat-messages");
        container.innerHTML = "";

        snap.forEach((child) => {
            const m = child.val();
            const div = document.createElement("div");

            div.textContent =
                m.sender +
                ": " +
                m.text +
                (m.edited ? " (edited)" : "");

            container.appendChild(div);
        });
    });
};

/* ---------------------------------------------------------
   UTIL — LOGOUT
--------------------------------------------------------- */
window.logout = function () {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentRoom");
    window.location.href = "index.html";
};
