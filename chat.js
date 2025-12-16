import { db } from "./app.js";
import { ref, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const room = new URLSearchParams(location.search).get("room");
document.getElementById("room-title").textContent = room;

const box = document.getElementById("messages");
const user = window.currentUser;

if(user.banned?.global) alert("You are banned and cannot join this room.");

/* LOAD MESSAGES */
onValue(ref(db, `rooms/${room}/messages`), snap => {
  box.innerHTML = "";
  snap.forEach(m => {
    const msg = m.val();
    const d = document.createElement("div");
    d.className = "msg";

    if(msg.system) { d.textContent = msg.text; }
    else {
      d.innerHTML = `<span>${msg.sender}: ${msg.text}</span>`;
      if(msg.sender === user.username){
        const del = document.createElement("button");
        del.textContent = "🗑";
        del.className = "del-btn";
        del.onclick = () => remove(ref(db, `rooms/${room}/messages/${m.key}`));
        d.appendChild(del);
      }
    }
    box.appendChild(d);
  });
});

/* SEND MESSAGE */
document.getElementById("chat-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if(!text) return;

  if(user.muted?.global){ alert("You are muted"); return; }

  // Command parser
  if(text.startsWith("?/")) parseCommand(text.slice(2));

  push(ref(db, `rooms/${room}/messages`), { sender:user.username, text, time:Date.now() });
  input.value = "";
});

/* LEAVE ROOM */
window.leaveRoom = () => location.href="dashboard.html";

/* COMMAND PARSER */
async function parseCommand(cmd){
  const parts = cmd.split(" ");
  if(parts[0]==="msg" && parts[1] && parts[2]){
    const target = parts[1];
    const msgText = cmd.split('"')[1] || "";
    if(msgText){
      // Only sender+receiver+core/pioneer can see
      const targetSnap = await get(ref(db, `users/${target}`));
      const coreRanks = ["core","pioneer"];
      const canSee = coreRanks.includes(user.rank) || targetSnap.exists() && targetSnap.val();
      if(canSee){
        push(ref(db, `rooms/${room}/messages`), {
          sender:user.username,
          text:`[PM -> ${target}] ${msgText}`,
          time:Date.now(),
          private:[user.username,target]
        });
      }
    }
  }
}
