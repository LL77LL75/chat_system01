import { db } from "./app.js";
import { ref, push, set, onValue, remove, onDisconnect, get, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const room = params.get("room");
const msgBox = document.getElementById("messages");
const input = document.getElementById("msg-input");
const titleEl = document.getElementById("room-title");

if (!room || !window.currentUser) location.href = "dashboard.html";

titleEl.textContent = "Room: " + room;
const username = window.currentUser.username;

// Join room
const memberRef = ref(db, `members/${room}/${username}`);
set(memberRef, { joinedAt: Date.now() });
onDisconnect(memberRef).remove();
push(ref(db, `messages/${room}`), { text:`[SYSTEM] ${username} joined.`, system:true, time:Date.now() });

// Leave room
window.leaveRoom = async function() {
    await push(ref(db, `messages/${room}`), { text:`[SYSTEM] ${username} left.`, system:true, time:Date.now() });
    await remove(memberRef);
    location.href = "dashboard.html";
};

// Check mute/ban
async function checkBanMute() {
    const banSnap = await get(ref(db, `bans/${username}`));
    if (banSnap.exists()) { alert("You are banned."); location.href="dashboard.html"; return false; }
    const muteSnap = await get(ref(db, `mutes/${username}`));
    if (muteSnap.exists()) { alert("You are muted."); return false; }
    return true;
}

// Send message with post-actions
window.sendMessage = async function() {
    const text = input.value.trim();
    if(!text) return;
    if(!(await checkBanMute())) return;

    const msgRef = push(ref(db, `messages/${room}`));
    await set(msgRef, { sender: username, text, title: window.currentUser.activeTitle||"", time:Date.now(), reactions:{} });
    input.value = "";
};

// Constant message display + post-actions (edit + reactions)
onValue(ref(db, `messages/${room}`), snap => {
    msgBox.innerHTML = "";
    snap.forEach(msgSnap => {
        const m = msgSnap.val();
        const div = document.createElement("div");
        div.className = m.system ? "system-msg" : "chat-msg";
        div.dataset.msgId = msgSnap.key;
        div.dataset.sender = m.sender || "[SYSTEM]";
        div.textContent = m.system ? m.text : `[${m.title}] ${m.sender}: ${m.text}`;

        // Post-message actions
        if(!m.system){
            // Reactions
            const emojis = ["❤️","👍","😂"];
            emojis.forEach(e => {
                const reactBtn = document.createElement("button");
                reactBtn.textContent = e + (m.reactions && m.reactions[e] ? ` (${Object.keys(m.reactions[e]).length})` : "");
                reactBtn.onclick = async () => {
                    const path = ref(db, `messages/${room}/${msgSnap.key}/reactions/${e}/${username}`);
                    const snap = await get(path);
                    if(snap.exists()) remove(path);
                    else set(path, true);
                };
                div.appendChild(reactBtn);
            });

            // Edit button
            if(m.sender === username){
                const editBtn = document.createElement("button");
                editBtn.textContent = "✏️";
                editBtn.onclick = async () => {
                    const newText = prompt("Edit message:", m.text);
                    if(newText) await update(ref(db, `messages/${room}/${msgSnap.key}`), { text:newText });
                };
                div.appendChild(editBtn);
            }
        }

        msgBox.appendChild(div);
    });
    msgBox.scrollTop = msgBox.scrollHeight;
});
