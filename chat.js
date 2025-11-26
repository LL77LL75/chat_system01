// chat.js — handles chat page UI behavior

import { db } from "./app.js";
import {
    ref, push, onValue, remove, get
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Parse ?room=XXXX
const params = new URLSearchParams(window.location.search);
const room = params.get("room");

// Guard if no room provided
if (!room) {
    document.body.innerHTML = "<p>No room specified. <a href='dashboard.html'>Back to dashboard</a></p>";
    throw new Error("No room specified");
}

const roomTitleEl = document.getElementById("room-title");
if (roomTitleEl) roomTitleEl.textContent = "Room: " + room;

/* ==========================
   LOAD MESSAGES
========================== */
const msgBox = document.getElementById("messages");

onValue(ref(db, "messages/" + room), (snap) => {
    if (!msgBox) return;

    msgBox.innerHTML = "";

    // Snap may be null when there are no messages
    snap.forEach((msgSnap) => {
        const m = msgSnap.val() || {};
        const div = document.createElement("div");

        if (m.system) {
            div.className = "system-msg";
            // Display friendly text for join/leave messages
            div.textContent = m.text || `${m.sender} (system)`;
        } else {
            let t = (m.title ? "[" + m.title + "] " : "") + (m.sender ? m.sender + ": " : "") + (m.text || "");
            div.textContent = t;
        }

        msgBox.appendChild(div);
    });

    // scroll to bottom
    msgBox.scrollTop = msgBox.scrollHeight;
}, (err) => {
    console.warn("messages onValue error:", err);
});

/* ==========================
   SEND MESSAGE
========================== */
window.sendMessage = async function () {
    const user = window.currentUser;
    if (!user) return alert("Not logged in.");

    const input = document.getElementById("msg-input");
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = "";

    try {
        await push(ref(db, "messages/" + room), {
            sender: user.username,
            text,
            time: Date.now(),
            title: user.activeTitle || "",
            system: false
        });
    } catch (err) {
        console.error("sendMessage error:", err);
        alert("Failed to send message.");
    }
};

/* ==========================
   LEAVE ROOM
========================== */
window.leaveRoom = async function () {
    if (!window.currentUser) return alert("Not logged in.");

    const u = window.currentUser.username;

    try {
        await remove(ref(db, `roomMembers/${room}/${u}`));

        await push(ref(db, `messages/${room}`), {
            sender: u,
            text: `${u} has left the chat.`,
            time: Date.now(),
            system: true
        });

        // Go back to dashboard
        window.location.href = "dashboard.html";
    } catch (err) {
        console.error("leaveRoom error:", err);
        alert("Failed to leave room.");
    }
};
