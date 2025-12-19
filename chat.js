import { db } from "./app.js";
import {
  ref, push, onValue, remove
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const params = new URLSearchParams(location.search);
const room = params.get("room");

const title = document.getElementById("room-title");
if (title) title.textContent = "Room: " + room;

const box = document.getElementById("messages");

/* ================= LOAD ================= */
onValue(ref(db, "messages/" + room), snap => {
  if (!box) return;
  box.innerHTML = "";

  snap.forEach(m => {
    const msg = m.val();
    const div = document.createElement("div");
    div.className = "msg";

    const label = document.createElement("span");
    label.className = "msg-label";

    if (!msg.system) {
      const t = msg.title ? `[${msg.title}] ` : "";
      label.textContent = `${t}${msg.sender}: `;
    }

    const text = document.createElement("span");
    text.textContent = msg.text;

    div.appendChild(label);
    div.appendChild(text);

    // DELETE BUTTON (OWN MSG ONLY)
    if (
      !msg.system &&
      window.currentUser &&
      msg.sender === window.currentUser.username
    ) {
      const del = document.createElement("button");
      del.textContent = "🗑";
      del.className = "del-btn";
      del.onclick = () =>
        remove(ref(db, `messages/${room}/${m.key}`));

      div.appendChild(del);
    }

    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
});

/* ================= SEND ================= */
window.sendMessage = () => {
  const input = document.getElementById("msg-input");
  if (!input || !input.value.trim() || !window.currentUser) return;

  push(ref(db, "messages/" + room), {
    sender: window.currentUser.username,
    title: window.currentUser.activeTitle || "",
    text: input.value.trim(),
    time: Date.now()
  });

  input.value = "";
};

/* ================= LEAVE ================= */
window.leaveRoom = async () => {
  location.href = "dashboard.html";
};
