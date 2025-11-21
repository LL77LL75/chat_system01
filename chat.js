import { db } from "./firebase-config.js";
import { ref, push, update, onValue, remove, set } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

window.addEventListener("load", () => {
    if (!location.pathname.includes("chat.html")) return;

    window.room = new URLSearchParams(location.search).get("room");
    document.getElementById("room-title").textContent = "Room: " + window.room;

    joinRoom();
    loadMessages();
});

/* JOIN ROOM */
async function joinRoom() {
    await set(ref(db, `roomUsers/${room}/${window.currentUser.username}`), true);
}

/* LEAVE ROOM */
window.leaveChat = async function () {
    await remove(ref(db, `roomUsers/${room}/${window.currentUser.username}`));
};

/* SEND MESSAGE */
window.sendMessage = async function () {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if (!msg) return;

    await push(ref(db, "messages/" + room), {
        sender: window.currentUser.username,
        displayName: window.currentUser.displayName || window.currentUser.username,
        message: msg,
        timestamp: Date.now(),
        reactions: {}
    });

    input.value = "";
};

/* LOAD MESSAGES */
function loadMessages() {
    const box = document.getElementById("messages");

    onValue(ref(db, "messages/" + room), snap => {
        box.innerHTML = "";

        snap.forEach(child => {
            const d = child.val();

            const div = document.createElement("div");
            div.className = "message";
            div.innerHTML = `<b>${d.displayName}</b> (${d.sender}): ${d.message}<br><small>${new Date(d.timestamp).toLocaleTimeString()}</small>`;

            if (["core","pioneer"].includes(window.currentUser.rank)) {
                const del = document.createElement("button");
                del.textContent = "Delete";
                del.onclick = () => remove(ref(db, `messages/${room}/${child.key}`));
                div.appendChild(del);
            }

            div.onclick = async () => {
                const r = prompt("Reaction?");
                if (!r) return;

                const reactions = d.reactions || {};
                reactions[window.currentUser.username] = r;

                await update(ref(db, `messages/${room}/${child.key}`), { reactions });
            };

            box.appendChild(div);
        });
    });
}
