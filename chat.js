import { db } from "./app.js";
import {
  ref, push, onValue, update, remove
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const room = new URLSearchParams(location.search).get("room");
const box = document.getElementById("messages");
const input = document.getElementById("msg-input");
const user = window.currentUser.username;

/* SEND */
window.sendMessage = async () => {
  if (!input.value.trim()) return;
  await push(ref(db, `messages/${room}`), {
    user,
    text: input.value,
    time: Date.now()
  });
  input.value = "";
};

/* RECEIVE */
onValue(ref(db, `messages/${room}`), snap => {
  box.innerHTML = "";
  snap.forEach(m => {
    const d = m.val();
    const div = document.createElement("div");

    div.className = d.system ? "system-msg" : "chat-msg";
    div.innerHTML = d.system
      ? d.text
      : `<b>${d.user}</b>: ${d.text}`;

    /* EDIT */
    if (d.user === user && !d.system) {
      const e = document.createElement("button");
      e.textContent = "Edit";
      e.onclick = () => {
        const t = prompt("Edit message:", d.text);
        if (t) update(ref(db, `messages/${room}/${m.key}`), { text: t });
      };
      div.appendChild(e);
    }

    /* REACTIONS */
    if (!d.system) {
      ["👍","❤️","😂"].forEach(r => {
        const b = document.createElement("button");
        b.textContent = r;
        b.onclick = () =>
          update(ref(db, `messages/${room}/${m.key}/reactions/${r}/${user}`), true);
        div.appendChild(b);
      });
    }

    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
});

/* LEAVE */
window.leaveRoom = () => {
  push(ref(db, `messages/${room}`), {
    system: true,
    text: `[SYSTEM] ${user} left`,
    time: Date.now()
  });
  remove(ref(db, `roomMembers/${room}/${user}`));
  location.href = "dashboard.html";
};
