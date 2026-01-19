import { db } from "./app.js";
import {
  ref,
  push,
  onValue,
  set,
  remove,
  get,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

/* ---------- INIT ---------- */
const room = new URLSearchParams(location.search).get("room");
const user = window.currentUser;

if (!user || !room) {
  alert("Session expired");
  location.replace("index.html");
}

document.getElementById("room-title").textContent = room;

/* ---------- RANKS ---------- */
const RANK_LEVEL = {
  newbie: 0,
  member: 1,
  admin: 2,
  high: 3,
  core: 4,
  pioneer: 5
};

const myLevel = RANK_LEVEL[user.rank] ?? 0;

const COMMAND_LEVEL = {
  kick: 2,
  mute: 2,
  unmute: 2,
  ban: 3,
  unban: 3
};

const can = cmd => myLevel >= COMMAND_LEVEL[cmd];

/* ---------- LISTENER MANAGEMENT ---------- */
const unsubscribers = [];
const listen = (r, cb) => {
  const unsub = onValue(r, cb);
  unsubscribers.push(unsub);
};

/* ---------- PRESENCE ---------- */
set(ref(db, `presence/${room}/${user.username}`), true);

/* ---------- CLEANUP ---------- */
function cleanup() {
  unsubscribers.forEach(u => u());
  remove(ref(db, `presence/${room}/${user.username}`));
}

window.addEventListener("beforeunload", cleanup);
window.leaveRoom = () => {
  cleanup();
  location.href = "dashboard.html";
};

/* ---------- INFO PANEL ---------- */
const inside = document.getElementById("inside-list");
const muted = document.getElementById("muted-list");
const banned = document.getElementById("banned-list");

listen(ref(db, `presence/${room}`), snap => {
  inside.innerHTML = "";
  snap.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.key;

    if (can("kick") || can("mute") || can("ban")) {
      const box = document.createElement("span");
      box.className = "admin-actions";

      if (can("kick")) addBtn(box, "👢", () => kick(u.key));
      if (can("mute")) addBtn(box, "🔇", () => mute(u.key));
      if (can("ban")) addBtn(box, "⛔", () => ban(u.key));

      li.appendChild(box);
    }

    inside.appendChild(li);
  });
});

/* ---------- MUTES (NON-LIVE) ---------- */
async function refreshMutes() {
  const snap = await get(ref(db, `roomMutes/${room}`));
  muted.innerHTML = "";
  snap.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.key;
    if (can("unmute")) addBtn(li, "🔊", () => unmute(u.key));
    muted.appendChild(li);
  });
}

setInterval(refreshMutes, 30000);
refreshMutes();

/* ---------- BANS (NON-LIVE) ---------- */
async function refreshBans() {
  const snap = await get(ref(db, `roomBans/${room}`));
  banned.innerHTML = "";
  snap.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.key;
    if (can("unban")) addBtn(li, "✅", () => unban(u.key));
    banned.appendChild(li);
  });

  if (snap.hasChild(user.username)) {
    alert("You are banned");
    cleanup();
    location.href = "dashboard.html";
  }
}

setInterval(refreshBans, 30000);
refreshBans();

/* ---------- ADMIN HELPERS ---------- */
function addBtn(parent, text, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = fn;
  parent.appendChild(b);
}

function system(text) {
  push(ref(db, `messages/${room}`), {
    system: true,
    text,
    time: Date.now()
  });
}

async function kick(target) {
  if (!can("kick")) return;
  await remove(ref(db, `presence/${room}/${target}`));
  system(`👢 ${target} kicked`);
}

async function mute(target) {
  if (!can("mute")) return;
  const mins = Number(prompt("Minutes?", 5)) || 5;
  await set(ref(db, `roomMutes/${room}/${target}`), {
    until: Date.now() + mins * 60000
  });
  system(`🔇 ${target} muted for ${mins} min`);
}

async function ban(target) {
  if (!can("ban")) return;
  await set(ref(db, `roomBans/${room}/${target}`), true);
  await remove(ref(db, `presence/${room}/${target}`));
  system(`⛔ ${target} banned`);
}

async function unmute(target) {
  await remove(ref(db, `roomMutes/${room}/${target}`));
  system(`🔊 ${target} unmuted`);
}

async function unban(target) {
  await remove(ref(db, `roomBans/${room}/${target}`));
  system(`✅ ${target} unbanned`);
}

/* ---------- SEND ---------- */
const input = document.getElementById("msg-input");

window.sendMessage = async () => {
  let text = input.value.trim();
  if (!text) return;

  const muteSnap = await get(ref(db, `roomMutes/${room}/${user.username}`));
  if (muteSnap.exists() && Date.now() < muteSnap.val().until) {
    alert("You are muted");
    input.value = "";
    return;
  }

  if (text.startsWith("?/")) {
    const [cmd, target] = text.slice(2).split(" ");
    if (cmd && target && can(cmd)) {
      ({ kick, mute, ban, unmute, unban }[cmd])?.(target);
    } else {
      system("❌ No permission");
    }
    input.value = "";
    return;
  }

  text = text.replace(
    /(https?:\/\/\S+|www\.\S+)/g,
    u => `<a href="${u.startsWith("http") ? u : "https://" + u}" target="_blank">${u}</a>`
  );

  push(ref(db, `messages/${room}`), {
    user: user.username,
    text,
    time: Date.now()
  });

  input.value = "";
};

/* ---------- MESSAGES (LIMITED + LIVE) ---------- */
const msgRef = query(
  ref(db, `messages/${room}`),
  limitToLast(100)
);

listen(msgRef, snap => {
  const box = document.getElementById("messages");
  box.innerHTML = "";

  snap.forEach(s => {
    const m = s.val();
    const d = document.createElement("div");
    d.className = m.system ? "system-msg" : "chat-msg";
    d.innerHTML = m.system ? m.text : `<b>${m.user}</b>: ${m.text}`;
    box.appendChild(d);
  });

  box.scrollTop = box.scrollHeight;
});
