// chat.js

import { db } from "./app.js";
import {
    ref, push, set, onValue, remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Parse ?room=XXXX
const params = new URLSearchParams(window.location.search);
const room = params.get("room");

document.getElementById("room-title").textContent = "Room: " + room;

/* ==========================
   LOAD MESSAGES
=========================== */
const msgBox = document.getElementById("messages");

onValue(ref(db, "messages/" + room), (snap) => {
    msgBox.innerHTML = "";

    snap.forEach((msgSnap) => {
        const m = msgSnap.val();
        const div = document.createElement("div");

        if (m.system) {
            div.className = "system-msg";
            div.textContent = m.text;
        } else {
            let t = m.sender + ": " + m.text;
            if (m.title) t = "[" + m.title + "] " + t;
            div.textContent = t;
        }

        msgBox.appendChild(div);
    });

    msgBox.scrollTop = msgBox.scrollHeight;
});

/* ==========================
   SEND MESSAGE
=========================== */
window.sendMessage = function () {
    const user = window.currentUser;
    if (!user) return alert("Not logged in.");

    const text = document.getElementById("msg-input").value.trim();
    if (!text) return;

    document.getElementById("msg-input").value = "";

    push(ref(db, "messages/" + room), {
        sender: user.username,
        text,
        time: Date.now(),
        title: user.activeTitle || ""
    });
};

/* ==========================
   LEAVE ROOM
=========================== */
window.leaveRoom = async function () {
    const u = window.currentUser.username;

    await remove(ref(db, `roomMembers/${room}/${u}`));

    push(ref(db, `messages/${room}`), {
        sender: u,
        text: "[SYSTEM] " + u + " has left.",
        time: Date.now(),
        system: true
    });

    window.location.href = "dashboard.html";
};
