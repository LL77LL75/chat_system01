import { db } from "./app.js";
import { ref, push, set, onValue, update, remove, get, onDisconnect }
from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const room = new URLSearchParams(location.search).get("room");
const user = window.currentUser.username;

document.getElementById("room-title").textContent = room;

const memberRef = ref(db, `roomMembers/${room}/${user}`);
set(memberRef, true);
onDisconnect(memberRef).remove();

/* ---------- SEND ---------- */
window.sendMessage = async () => {
  const i = msg-input;
  if (!i.value.trim()) return;
  await push(ref(db, `messages/${room}`), {
    sender:user,
    text:i.value,
    time:Date.now(),
    reactions:{}
  });
  i.value = "";
};

/* ---------- CHAT RENDER ---------- */
onValue(ref(db, `messages/${room}`), snap => {
  messages.innerHTML = "";
  snap.forEach(s => {
    const m = s.val();
    const d = document.createElement("div");
    d.className = m.system ? "system-msg" : "chat-msg";

    if (m.system) {
      d.textContent = m.text;
    } else {
      d.innerHTML = `<b>${m.sender}</b>: <span>${m.text}</span>`;
      
      /* EDIT */
      if (m.sender === user) {
        const e = document.createElement("button");
        e.textContent = "✏️";
        e.onclick = () => {
          const t = prompt("Edit message", m.text);
          if (t) update(ref(db, `messages/${room}/${s.key}`), { text:t });
        };
        d.appendChild(e);
      }

      /* REACTIONS */
      ["👍","❤️","😂"].forEach(r => {
        const b = document.createElement("button");
        b.textContent = r;
        b.onclick = async () => {
          const p = ref(db, `messages/${room}/${s.key}/reactions/${r}/${user}`);
          const ex = await get(p);
          ex.exists() ? remove(p) : set(p,true);
        };
        d.appendChild(b);
      });
    }
    messages.appendChild(d);
  });
});

/* ---------- LEAVE ---------- */
window.leaveRoom = async () => {
  await push(ref(db, `messages/${room}`), {
    system:true,
    text:`[SYSTEM] ${user} left the room`,
    time:Date.now()
  });
  await remove(memberRef);
  location.href = "dashboard.html";
};
