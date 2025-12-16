import { db } from "./app.js";
import {
  ref, push, onChildAdded, remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const params = new URLSearchParams(location.search);
const room = params.get("room");
const user = window.currentUser;

const box = document.getElementById("messages");
document.getElementById("roomName").textContent = room;

/* =======================
   LOAD MESSAGES
======================= */
onChildAdded(ref(db, `rooms/${room}/messages`), snap => {
  const m = snap.val();
  const div = document.createElement("div");

  if (m.system) {
    div.className = "system-msg";
    div.textContent = m.text;
  } else {
    div.innerHTML = `<b>${m.sender}</b>: ${m.text}`;

    if (m.sender === user.username) {
      const del = document.createElement("button");
      del.textContent = "🗑";
      del.onclick = () =>
        remove(ref(db, `rooms/${room}/messages/${snap.key}`));
      div.appendChild(del);
    }
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});

/* =======================
   SEND
======================= */
window.sendMessage = async () => {
  if (user.muted?.global) {
    alert("You are muted.");
    return;
  }

  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  await push(ref(db, `rooms/${room}/messages`), {
    sender: user.username,
    text,
    time: Date.now()
  });
};

/* =======================
   LEAVE
======================= */
window.leaveRoomCmd = () => {
  location.href = "dashboard.html";
};
