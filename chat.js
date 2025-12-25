import { db } from "./app.js";
import { ref, push, set, onValue, remove, get, onDisconnect } 
from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const room = new URLSearchParams(location.search).get("room");
if (!room || !window.currentUser) location.href = "dashboard.html";

const user = window.currentUser.username;
document.getElementById("room-title").textContent = room;

const memberRef = ref(db, `roomMembers/${room}/${user}`);
set(memberRef, true);
onDisconnect(memberRef).remove();

window.leaveRoom = async () => {
  await remove(memberRef);
  location.href = "dashboard.html";
};

window.sendMessage = async () => {
  const input = document.getElementById("msg-input");
  if (!input.value.trim()) return;

  await push(ref(db, `messages/${room}`), {
    sender: user,
    title: window.currentUser.activeTitle || "",
    text: input.value,
    time: Date.now()
  });
  input.value = "";
};

onValue(ref(db, `messages/${room}`), snap => {
  const box = document.getElementById("messages");
  box.innerHTML = "";
  snap.forEach(s => {
    const m = s.val();
    const div = document.createElement("div");
    div.className = m.system ? "system-msg" : "chat-msg";
    div.textContent = m.system ? m.text : `[${m.title}] ${m.sender}: ${m.text}`;

    if (m.sender === user) {
      const del = document.createElement("button");
      del.textContent = "🗑";
      del.className = "delete-btn";
      del.onclick = () => remove(ref(db, `messages/${room}/${s.key}`));
      div.appendChild(del);
    }
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
});
