import { db } from "./app.js";
import {
  ref,
  push,
  set,
  onValue,
  remove,
  get,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ------------------ BASIC SETUP ------------------ */

const params = new URLSearchParams(window.location.search);
const room = params.get("room");

const msgBox = document.getElementById("messages");
const input = document.getElementById("msg-input");
const titleEl = document.getElementById("room-title");

if (!room || !window.currentUser) {
  location.href = "dashboard.html";
}

titleEl.textContent = "Room: " + room;

const username = window.currentUser.username;

/* ------------------ JOIN / LEAVE ------------------ */

const memberRef = ref(db, `members/${room}/${username}`);
set(memberRef, { joinedAt: Date.now() });
onDisconnect(memberRef).remove();

// join system message
push(ref(db, `messages/${room}`), {
  system: true,
  text: `[SYSTEM] ${username} has joined the room.`,
  time: Date.now()
});

// leave handler
window.leaveRoom = async function () {
  await push(ref(db, `messages/${room}`), {
    system: true,
    text: `[SYSTEM] ${username} has left the room.`,
    time: Date.now()
  });
  await remove(memberRef);
  location.href = "dashboard.html";
};

/* ------------------ BAN / MUTE CHECK ------------------ */

async function checkBanMute() {
  const banSnap = await get(ref(db, `bans/${username}`));
  if (banSnap.exists()) {
    alert("You are banned.");
    location.href = "dashboard.html";
    return false;
  }

  const muteSnap = await get(ref(db, `mutes/${username}`));
  if (muteSnap.exists()) {
    alert("You are muted.");
    return false;
  }
  return true;
}

/* ------------------ SEND MESSAGE ------------------ */

window.sendMessage = async function () {
  const text = input.value.trim();
  if (!text) return;

  if (!(await checkBanMute())) return;

  await push(ref(db, `messages/${room}`), {
    sender: username,
    title: window.currentUser.activeTitle || "",
    text,
    time: Date.now()
  });

  input.value = "";
};

/* ------------------ MESSAGE LISTENER ------------------ */

onValue(ref(db, `messages/${room}`), snap => {
  msgBox.innerHTML = "";

  snap.forEach(msgSnap => {
    const m = msgSnap.val();
    const div = document.createElement("div");

    div.className = m.system ? "system-msg" : "chat-msg";

    if (m.system) {
      div.textContent = m.text;
    } else {
      div.textContent = `[${m.title}] ${m.sender}: ${m.text}`;

      // DELETE BUTTON (your messages only)
      if (m.sender === username) {
        const del = document.createElement("button");
        del.textContent = "🗑";
        del.className = "delete-btn";
        del.style.display = "none";

        del.onclick = () => {
          remove(ref(db, `messages/${room}/${msgSnap.key}`));
        };

        div.appendChild(del);

        div.onmouseenter = () => (del.style.display = "inline");
        div.onmouseleave = () => (del.style.display = "none");
      }
    }

    msgBox.appendChild(div);
  });

  msgBox.scrollTop = msgBox.scrollHeight;
});

/* ------------------ ACCOUNT POPUP ------------------ */

window.openAccountPopup = function () {
  document.getElementById("account-popup").style.display = "block";
};

window.closeAccountPopup = function () {
  document.getElementById("account-popup").style.display = "none";
};
