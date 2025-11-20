import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// =================== Global Current User ===================
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// =================== Normal Login ===================
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

// =================== Logout ===================
window._LOGOUT = function () {
    // Save last logout timestamp
    const logoutRef = ref(db, `logins/${window.currentUser.username}/logout`);
    set(logoutRef, Date.now());
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

// =================== Account Popup ===================
window._accPop = function () {
    const displayName = prompt("Enter new display name:", window.currentUser.displayName || window.currentUser.username);
    if (displayName) {
        window.currentUser.displayName = displayName;
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        const dbRef = ref(db, "users/" + window.currentUser.username);
        update(dbRef, { displayName: displayName });
        alert("Display name updated!");
    }
};

// =================== Credits System (1 min interval) ===================
function creditTick() {
    if (!window.currentUser.username) return;
    const rank = window.currentUser.rank || "newbie";
    let creditsToAdd = 0;

    switch(rank){
        case "newbie": creditsToAdd = 1; break;
        case "member": creditsToAdd = 1; break;
        case "admin": creditsToAdd = 1; break;
        case "high": creditsToAdd = 1; break;
        case "core": creditsToAdd = 1; break;
        case "pioneer": creditsToAdd = 0; break;
    }

    const creditRef = ref(db, `users/${window.currentUser.username}/credits`);
    get(creditRef).then(snap => {
        let currentCredits = snap.exists() ? snap.val() : 0;
        currentCredits += creditsToAdd;
        set(creditRef, currentCredits);
        window.currentUser.credits = currentCredits;
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    });
}

// Start 1-min interval
setInterval(creditTick, 60*1000);

// =================== Redirect Buttons ===================
window._GO_CHAT = function(roomCode){
    window.location.href = `chat.html?room=${roomCode}`;
};

window._GO_DASH = function(){
    window.location.href = "dashboard.html";
};

// =================== Account creation (Core/Pioneer) ===================
window._CREATE_USER = async function() {
    const currentRank = window.currentUser.rank || "newbie";
    if (!["core","pioneer"].includes(currentRank)) {
        alert("Only Core or Pioneer can create accounts!");
        return;
    }

    const username = prompt("Enter username for new account:");
    const password = prompt("Enter password:");
    if (!username || !password) return;

    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);
    if (snap.exists()) {
        alert("Username already exists!");
        return;
    }

    await set(userRef, {
        password: password,
        displayName: username,
        rank: "newbie",
        credits: 0,
        titles: ["newbie","newcomer"]
    });

    alert("New user created!");
};
