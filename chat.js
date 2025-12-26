import { db } from "./app.js";
import {
  ref, push, onValue, set, remove, get
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const room = new URLSearchParams(location.search).get("room");
const user = window.currentUser;
document.getElementById("room-title").textContent = room;

const RANK_LEVEL = { newbie:0, member:1, admin:2, high:3, core:4, pioneer:5 };
const myLevel = RANK_LEVEL[user.rank] ?? 0;

/* ---------- PRESENCE ---------- */
set(ref(db, `presence/${room}/${user.username}`), true);
window.addEventListener("beforeunload", () =>
  remove(ref(db, `presence/${room}/${user.username}`))
);

/* ---------- INFO PANEL ---------- */
const inside = document.getElementById("inside-list");
const muted = document.getElementById("muted-list");
const banned = document.getElementById("banned-list");

onValue(ref(db, `presence/${room}`), s => {
  inside.innerHTML = "";
  s.forEach(u => inside.innerHTML += `<li>${u.key}</li>`);
});

onValue(ref(db, `roomMutes/${room}`), s => {
  muted.innerHTML = "";
  s.forEach(u => muted.innerHTML += `<li>${u.key}</li>`);
});

onValue(ref(db, `roomBans/${room}`), s => {
  banned.innerHTML = "";
  s.forEach(u => banned.innerHTML += `<li>${u.key}</li>`);
});

/* ---------- AUTO UNMUTE CLEANUP ---------- */
setInterval(async () => {
  const snap = await get(ref(db, `roomMutes/${room}`));
  snap.forEach(u => {
    if (Date.now() > u.val().until)
      remove(ref(db, `roomMutes/${room}/${u.key}`));
  });
}, 30000);

/* ---------- AUTO CLEANUP 25 DAYS ---------- */
const MAX_AGE = 25 * 24 * 60 * 60 * 1000;

setInterval(async () => {
  const snap = await get(ref(db, `messages/${room}`));
  snap.forEach(m => {
    if (Date.now() - m.val().time > MAX_AGE)
      remove(ref(db, `messages/${room}/${m.key}`));
  });
}, 600000);

/* ---------- AUTOCOMPLETE ---------- */
const commands = ["?/msg", "?/kick", "?/mute", "?/ban", "?/unmute", "?/unban"];
const ac = document.getElementById("autocomplete");
const input = document.getElementById("msg-input");

input.addEventListener("input", () => {
  const v = input.value;
  ac.innerHTML = "";
  if (!v.startsWith("?/")) return ac.style.display = "none";

  commands.filter(c => c.startsWith(v)).forEach(c => {
    const d = document.createElement("div");
    d.textContent = c;
    d.onclick = () => {
      input.value = c + " ";
      ac.style.display = "none";
      input.focus();
    };
    ac.appendChild(d);
  });

  ac.style.display = ac.children.length ? "block" : "none";
});

/* ---------- SEND ---------- */
window.sendMessage = async () => {
  let text = input.value.trim();
  if (!text) return;

  /* LINK AUTOPARSE */
  text = text.replace(
    /(https?:\/\/\S+|www\.\S+)/g,
    url => `<a href="${url.startsWith("http") ? url : "https://" + url}" target="_blank">${url}</a>`
  );

  push(ref(db, `messages/${room}`), {
    user: user.username,
    text,
    time: Date.now()
  });

  input.value = "";
};

/* ---------- RENDER ---------- */
onValue(ref(db, `messages/${room}`), snap => {
  const box = document.getElementById("messages");
  box.innerHTML = "";

  snap.forEach(s => {
    const m = s.val();
    const d = document.createElement("div");
    d.className =
      m.type === "ban" ? "chat-msg system-ban" :
      m.type === "mute" ? "chat-msg system-mute" :
      m.system ? "system-msg" : "chat-msg";

    d.innerHTML = m.system ? m.text : `<b>${m.user}</b>: ${m.text}`;
    box.appendChild(d);
  });

  box.scrollTop = box.scrollHeight;
});

/* ---------- LEAVE ---------- */
window.leaveRoom = () => location.href = "dashboard.html";
