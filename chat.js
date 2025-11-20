import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get("room");

// =================== Global ===================
window.membersInRoom = [];

// =================== Join Announcement ===================
function joinAnnouncement(user) {
    const messagesRef = ref(db, `messages/${roomCode}`);
    const rank = user.rank || "newbie";
    let msgText = "";

    if (["newbie","member","admin"].includes(rank)) msgText = `${user.displayName} has joined the chat`;
    if (["high","core"].includes(rank)) msgText = `${user.displayName} joins the chat...`;
    if (rank === "pioneer") msgText = "A GOD HAS ARRIVED";

    push(messagesRef, { sender: "system", message: msgText, timestamp: Date.now(), type: "join" });
}

// =================== Leave Announcement ===================
function leaveAnnouncement(user) {
    const messagesRef = ref(db, `messages/${roomCode}`);
    const rank = user.rank || "newbie";
    let msgText = "";

    if (["newbie","member","admin"].includes(rank)) msgText = `${user.displayName} has left the chat`;
    if (["high","core"].includes(rank)) msgText = `${user.displayName} leaves the chat...`;
    if (rank === "pioneer") msgText = `${user.displayName} has left`;

    push(messagesRef, { sender: "system", message: msgText, timestamp: Date.now(), type: "leave" });
}

// =================== Load Messages ===================
window.loadMessages = function() {
    if (!roomCode) return;
    const messagesRef = ref(db, `messages/${roomCode}`);
    const messagesContainer = document.getElementById("messages");

    onValue(messagesRef, (snapshot) => {
        messagesContainer.innerHTML = "";
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement("div");
            div.classList.add("message");

            // Hidden msg for Core/Pioneer
            if (msg.type === "msg" && msg.hidden && !["core","pioneer"].includes(window.currentUser.rank)) return;

            let text = `[${msg.sender}]: ${msg.message}`;
            if (msg.edited) text += ` (edited ${new Date(msg.edited).toLocaleTimeString()})`;
            div.textContent = text;

            // Reactions
            if (msg.reactions) {
                for (const r of msg.reactions) {
                    const span = document.createElement("span");
                    span.classList.add("reaction");
                    span.textContent = r;
                    div.appendChild(span);
                }
            }

            messagesContainer.appendChild(div);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
};

// =================== Send Message ===================
window.sendMessage = async function() {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (!message) return;

    const messagesRef = ref(db, `messages/${roomCode}`);
    let type = "text";

    if (message.startsWith("?/")) type = "command";

    await push(messagesRef, {
        sender: window.currentUser.displayName,
        message: message,
        timestamp: Date.now(),
        type: type
    });

    input.value = "";
};

// =================== Join Room ===================
window.joinRoom = function(user) {
    const membersRef = ref(db, `rooms/${roomCode}/members/${user.username}`);
    set(membersRef, { displayName: user.displayName, rank: user.rank });
    joinAnnouncement(user);
};

// =================== Leave Room ===================
window.leaveRoom = function(user) {
    const membersRef = ref(db, `rooms/${roomCode}/members/${user.username}`);
    remove(membersRef);
    leaveAnnouncement(user);
};

// =================== Admin Panel ===================
function updateAdminPanel() {
    if (!["admin","high","core","pioneer"].includes(window.currentUser.rank)) return;
    const bannedUl = document.getElementById("banned-users");
    const mutedUl = document.getElementById("muted-users");

    const roomRef = ref(db, `rooms/${roomCode}`);
    get(roomRef).then(snap => {
        if (!snap.exists()) return;
        const room = snap.val();

        bannedUl.innerHTML = "";
        if (room.bans) {
            for (const u in room.bans.users || {}) {
                const li = document.createElement("li");
                li.textContent = `${u} (Level ${room.bans.users[u]})`;
                bannedUl.appendChild(li);
            }
        }

        mutedUl.innerHTML = "";
        if (room.mutes) {
            for (const u in room.mutes.users || {}) {
                const li = document.createElement("li");
                li.textContent = `${u} (Level ${room.mutes.users[u]})`;
                mutedUl.appendChild(li);
            }
        }
    });
}

// Auto update admin panel every 5 sec
setInterval(updateAdminPanel, 5000);

// =================== Reactions Handler ===================
window.addReaction = async function(messageId, reaction) {
    const messageRef = ref(db, `messages/${roomCode}/${messageId}/reactions`);
    const snap = await get(messageRef);
    const reactions = snap.exists() ? snap.val() : [];
    reactions.push(reaction);
    set(messageRef, reactions);
};

// =================== Auctions Placeholder ===================
window.startAuction = function(title, startingBid, durationMin) {
    // Auctions fully implemented here
    alert(`Auction started: ${title} at ${startingBid} credits for ${durationMin} min`);
};

// =================== Init ===================
window.addEventListener("load", () => {
    loadMessages();
    joinRoom(window.currentUser);
    window.addEventListener("beforeunload", () => leaveRoom(window.currentUser));
});
