import { db } from "./app.js";
import { ref, push, onValue, remove } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const room = new URLSearchParams(location.search).get("room");
document.getElementById("room-title").textContent = room;

const box = document.getElementById("messages");

onValue(ref(db, "rooms/" + room + "/messages"), snap => {
  box.innerHTML = "";
  snap.forEach(m => {
    const d = document.createElement("div");
    d.className = "msg";

    d.innerHTML = `
      <span>${m.val().text}</span>
      ${m.val().sender === window.currentUser.username
        ? `<button class="del" onclick="deleteMsg('${room}','${m.key}')">🗑</button>`
        : ""}
    `;
    box.appendChild(d);
  });
});

window.sendMessage = () => {
  const t = msg.value.trim();
  if (!t) return;
  push(ref(db, "rooms/" + room + "/messages"), {
    sender: window.currentUser.username,
    text: t,
    time: Date.now()
  });
  msg.value = "";
};

window.deleteMsg = (r, k) =>
  remove(ref(db, `rooms/${r}/messages/${k}`));

window.leaveRoom = () =>
  location.href = "dashboard.html";
