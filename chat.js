import { db } from "./app.js";
import { ref, push, onChildAdded, remove } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const room = new URLSearchParams(location.search).get("room");
const user = window.currentUser;
const box = document.getElementById("messages");

document.getElementById("roomName").textContent = room;

onChildAdded(ref(db, `rooms/${room}/messages`), snap => {
  const m = snap.val();
  const wrap = document.createElement("div");
  wrap.className = "msg";

  if (m.system) {
    wrap.classList.add("system-msg");
    wrap.textContent = m.text;
  } else {
    wrap.innerHTML = `<span><b>${m.sender}</b>: ${m.text}</span>`;

    if (m.sender === user.username) {
      const del = document.createElement("button");
      del.className = "del-btn";
      del.textContent = "🗑";
      del.onclick = () =>
        remove(ref(db, `rooms/${room}/messages/${snap.key}`));
      wrap.appendChild(del);
    }
  }

  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
});

window.sendMessage = async () => {
  if (user.muted?.global) return alert("You are muted.");

  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  await push(ref(db, `rooms/${room}/messages`), {
    sender: user.username,
    text,
    time: Date.now(),
    lastSeen: user.lastSeen || Date.now()
  });
};

window.leaveRoomCmd = () => location.href = "dashboard.html";
