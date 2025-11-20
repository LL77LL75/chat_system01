import { db } from './firebase-config.js';
import { ref, onValue, set, get, push, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// -------------------- Room Members & Admin Panel --------------------
window.loadRoomInfo = function() {
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;

    const membersDiv = document.getElementById("room-members");
    const bannedDiv = document.getElementById("banned-users");
    const mutedDiv = document.getElementById("muted-users");

    // Members
    const membersRef = ref(db, `rooms/${roomCode}/members`);
    onValue(membersRef, snapshot => {
        membersDiv.innerHTML = "";
        snapshot.forEach(child => {
            const m = child.val();
            const li = document.createElement("li");
            li.textContent = m.displayName + " (" + m.rank + ")";
            membersDiv.appendChild(li);
        });
    });

    // Admin+ can see banned/muted
    if (["admin","high","core","pioneer"].includes(window.currentUser.rank)) {
        const bansRef = ref(db, `rooms/${roomCode}/bans`);
        onValue(bansRef, snapshot => {
            bannedDiv.innerHTML = "";
            snapshot.forEach(child => {
                const user = child.key;
                const lvl = child.val().level;
                const li = document.createElement("li");
                li.textContent = `${user} (banned level ${lvl})`;
                bannedDiv.appendChild(li);
            });
        });

        const mutesRef = ref(db, `rooms/${roomCode}/mutes`);
        onValue(mutesRef, snapshot => {
            mutedDiv.innerHTML = "";
            snapshot.innerHTML = ""; 
            snapshot.forEach(child => {
                const user = child.key;
                const lvl = child.val().level;
                const li = document.createElement("li");
                li.textContent = `${user} (muted level ${lvl})`;
                mutedDiv.appendChild(li);
            });
        });
    }
};

// -------------------- Join/Leave Messages --------------------
window.joinRoom = async function(user){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;
    const membersRef = ref(db, `rooms/${roomCode}/members/${user.username}`);
    await set(membersRef, { displayName: user.displayName, rank: user.rank });

    const messagesRef = ref(db, `messages/${roomCode}`);
    let joinMsg = "";
    if (user.rank === "pioneer") joinMsg = "A GOD HAS ARRIVED";
    else if (["high","core"].includes(user.rank)) joinMsg = `${user.displayName} joins the chat...`;
    else joinMsg = `${user.displayName} has joined the chat`;

    await push(messagesRef, { sender: "system", message: joinMsg, timestamp: Date.now(), system:true });
};

// Leave Room
window.leaveRoom = async function(user){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;
    const membersRef = ref(db, `rooms/${roomCode}/members/${user.username}`);
    await set(membersRef, null);

    const messagesRef = ref(db, `messages/${roomCode}`);
    let leaveMsg = "";
    if (user.rank === "pioneer") leaveMsg = `${user.displayName} has left`;
    else if (["high","core"].includes(user.rank)) leaveMsg = `${user.displayName} leaves the chat...`;
    else leaveMsg = `${user.displayName} has left the chat`;

    await push(messagesRef, { sender: "system", message: leaveMsg, timestamp: Date.now(), system:true });
};

// -------------------- Reactions --------------------
window.addReaction = async function(messageKey, reaction){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;
    const reactionRef = ref(db, `messages/${roomCode}/${messageKey}/reactions/${window.currentUser.username}`);
    await set(reactionRef, reaction);
};

// -------------------- Display Messages with Reactions --------------------
window.loadMessages = function(){
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);
    const messagesDiv = document.getElementById("messages");

    onValue(messagesRef, snapshot => {
        messagesDiv.innerHTML = "";
        snapshot.forEach(child=>{
            const m = child.val();
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            msgDiv.textContent = m.system ? m.message : `[${m.sender}]: ${m.message}`;

            // Reactions below
            if (!m.system && m.reactions) {
                const reactionsDiv = document.createElement("div");
                reactionsDiv.classList.add("reaction");
                Object.entries(m.reactions).forEach(([user, react])=>{
                    reactionsDiv.textContent += `${user}: ${react} `;
                });
                msgDiv.appendChild(reactionsDiv);
            }
            messagesDiv.appendChild(msgDiv);
        });
    });
};
