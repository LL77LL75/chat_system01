import { db } from "./app.js";
import { ref, push, onValue, remove } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const params = new URLSearchParams(location.search);
const room = params.get("room");

const title = document.getElementById("room-title");
if (title) title.textContent = "Room: " + room;

const box = document.getElementById("messages");

onValue(ref(db, "messages/" + room), snap => {
  if (!box) return;

  box.innerHTML = "";
  snap.forEach(m => {
    const d = document.createElement("div");
    const msg = m.val();
    d.textContent = msg.text;
    d.className = msg.system ? "system" : "user";
    box.appendChild(d);
  });
  box.scrollTop = box.scrollHeight;
});

window.sendMessage = function () {
  if (!window.currentUser) return;

  const input = document.getElementById("msg-input");
  if (!input || !input.value.trim()) return;

  push(ref(db, "messages/" + room), {
    sender: window.currentUser.username,
    text: input.value.trim(),
    time: Date.now()
  });

  input.value = "";
};

window.leaveRoom = async function () {
  if (!window.currentUser) return;

  await remove(ref(db, `members/${room}/${window.currentUser.username}`));
  location.href = "dashboard.html";
};
