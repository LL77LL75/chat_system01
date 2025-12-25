import { db } from "./app.js";
import { ref, push, onValue, set, remove, onDisconnect, get } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

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
push(ref(db, `messages/${room}`), { system: true, text:`[SYSTEM] ${username} joined the room.`, time: Date.now() });

// Leave room
window.leaveRoom = async function() {
  await push(ref(db, `messages/${room}`), { system: true, text:`[SYSTEM] ${username} left the room.`, time: Date.now() });
  await remove(memberRef);
  location.href = "dashboard.html";
};

// Send message
window.sendMessage = async function() {
  const text = input.value.trim();
  if (!text) return;
  await push(ref(db, `messages/${room}`), { sender: username, text, time: Date.now() });
  input.value = "";
};

// Listen for messages
onValue(ref(db, `messages/${room}`), snap => {
  msgBox.innerHTML = "";
  snap.forEach(msgSnap => {
    const m = msgSnap.val();
    const div = document.createElement("div");
    div.className = m.system ? "system-msg" : "chat-msg";
    div.textContent = m.system ? m.text : `${m.sender}: ${m.text}`;
    msgBox.appendChild(div);
  });
  msgBox.scrollTop = msgBox.scrollHeight;
});

// Account popup
window.openAccountPopup = () => document.getElementById("account-popup").style.display = "block";
window.closeAccountPopup = () => document.getElementById("account-popup").style.display = "none";
