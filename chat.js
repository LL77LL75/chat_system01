import { db } from "./app.js";
import { ref, push, set, onValue, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Get room from URL
const params = new URLSearchParams(window.location.search);
const room = params.get("room");

document.getElementById("room-title").textContent = "Room: " + room;

const msgBox = document.getElementById("messages");

/* ================= LOAD MESSAGES ================= */
onValue(ref(db, "messages/" + room), snap => {
  msgBox.innerHTML = "";

  snap.forEach(msgSnap => {
    const m = msgSnap.val();
    const div = document.createElement("div");
    div.className = "msg";

    if (m.system) {
      div.classList.add("system");
      div.textContent = m.text;
    } else {
      div.textContent = `[${m.title || ""}] ${m.sender}: ${m.text}`;

      // Delete button for own messages
      if (m.sender === window.currentUser.username) {
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.className = "del-btn";
        del.onclick = async () => {
          await remove(ref(db, `messages/${room}/${msgSnap.key}`));
        };
        div.appendChild(del);
      }
    }

    msgBox.appendChild(div);
  });

  msgBox.scrollTop = msgBox.scrollHeight;
});

/* ================= SEND MESSAGE ================= */
window.sendMessage = async function () {
  const user = window.currentUser;
  if (!user) return alert("Not logged in.");

  const text = document.getElementById("msg-input").value.trim();
  if (!text) return;

  document.getElementById("msg-input").value = "";

  // Check muted
  const bannedSnap = await get(ref(db, `users/${user.username}/banned`));
  const mutedSnap = await get(ref(db, `users/${user.username}/muted`));
  if ((bannedSnap.exists() && bannedSnap.val()) || (mutedSnap.exists() && mutedSnap.val())) {
    return alert("You are banned or muted!");
  }

  push(ref(db, `messages/${room}`), {
    sender: user.username,
    text,
    time: Date.now(),
    title: user.activeTitle || "",
  });
};

/* ================= LEAVE ROOM ================= */
window.leaveRoom = async function () {
  const u = window.currentUser.username;
  await remove(ref(db, `roomMembers/${room}/${u}`));
  push(ref(db, `messages/${room}`), {
    sender: u,
    text: `[SYSTEM] ${u} has left.`,
    time: Date.now(),
    system: true
  });
  window.location.href = "dashboard.html";
};

/* ================= REMOVE MEMBER ON TAB CLOSE ================= */
window.addEventListener("beforeunload", async () => {
  if (window.currentUser) {
    await remove(ref(db, `roomMembers/${room}/${window.currentUser.username}`));
  }
});

/* ================= AUTO CLEANUP ================= */
const CLEANUP_INTERVAL = 60 * 60 * 1000; // every hour
const MESSAGE_RETENTION = 15 * 24 * 60 * 60 * 1000; // 15 days
setInterval(async () => {
  const now = Date.now();

  const msgSnap = await get(ref(db, `messages/${room}`));
  if (!msgSnap.exists()) return;

  msgSnap.forEach(async mSnap => {
    const m = mSnap.val();
    if (!m.system && now - m.time > MESSAGE_RETENTION) {
      await remove(ref(db, `messages/${room}/${mSnap.key}`));
    }
    if (m.system && (m.text.includes("joined") || m.text.includes("left")) && now - m.time > 10 * 24 * 60 * 60 * 1000) {
      await remove(ref(db, `messages/${room}/${mSnap.key}`));
    }
  });
}, CLEANUP_INTERVAL);
