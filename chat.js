import { db } from "./app.js";
import {
  ref, push, onValue, set, remove, get
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

/* ---------- INIT ---------- */
const room = new URLSearchParams(location.search).get("room");
const user = window.currentUser;

if (!user || !room) location.href = "dashboard.html";

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

/* ---------- PRESENCE ---------- */
set(ref(db, `presence/${room}/${user.username}`), true);
window.addEventListener("beforeunload", () =>
  remove(ref(db, `presence/${room}/${user.username}`))
);

/* ---------- INFO PANEL + ADMIN UI ---------- */
const inside = document.getElementById("inside-list");
const muted = document.getElementById("muted-list");
const banned = document.getElementById("banned-list");

onValue(ref(db, `presence/${room}`), snap => {
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

onValue(ref(db, `roomMutes/${room}`), snap => {
  muted.innerHTML = "";
  snap.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.key;

    if (can("unmute")) addBtn(li, "🔊", () => unmute(u.key));
    muted.appendChild(li);
  });
});

onValue(ref(db, `roomBans/${room}`), snap => {
  banned.innerHTML = "";
  snap.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.key;

    if (can("unban")) addBtn(li, "✅", () => unban(u.key));
    banned.appendChild(li);
  });
});

/* ---------- BUTTON HELPER ---------- */
function addBtn(parent, text, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.onclick = fn;
  parent.appendChild(b);
}

/* ---------- COMMAND ACTIONS ---------- */
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
  if (!can("unmute")) return;
  await remove(ref(db, `roomMutes/${room}/${target}`));
  system(`🔊 ${target} unmuted`);
}

async function unban(target) {
  if (!can("unban")) return;
  await remove(ref(db, `roomBans/${room}/${target}`));
  system(`✅ ${target} unbanned`);
}

/* ---------- AUTO UNMUTE ---------- */
setInterval(async () => {
  const snap = await get(ref(db, `roomMutes/${room}`));
  snap.forEach(u => {
    if (Date.now() > u.val().until)
      remove(ref(db, `roomMutes/${room}/${u.key}`));
  });
}, 30000);

/* ---------- BAN ENFORCEMENT ---------- */
onValue(ref(db, `roomBans/${room}`), snap => {
  if (snap.hasChild(user.username)) {
    alert("You are banned");
    location.href = "dashboard.html";
  }
});

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
    await handleCommand(text);
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

/* ---------- TEXT COMMANDS ---------- */
async function handleCommand(text) {
  const [cmd, target, arg] = text.slice(2).split(" ");
  if (!can(cmd)) return system("❌ No permission");

  if (cmd === "kick") return kick(target);
  if (cmd === "mute") {
    await set(ref(db, `roomMutes/${room}/${target}`), {
      until: Date.now() + (Number(arg || 5) * 60000)
    });
    return system(`🔇 ${target} muted`);
  }
  if (cmd === "ban") return ban(target);
  if (cmd === "unmute") return unmute(target);
  if (cmd === "unban") return unban(target);
}

/* ---------- SYSTEM MESSAGE ---------- */
function system(text) {
  push(ref(db, `messages/${room}`), {
    system: true,
    text,
    time: Date.now()
  });
}

/* ---------- RENDER ---------- */
onValue(ref(db, `messages/${room}`), snap => {
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

/* ---------- LEAVE ---------- */
window.leaveRoom = () => location.href = "dashboard.html";
