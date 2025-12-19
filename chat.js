import { db } from "./app.js";
import { ref, push, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const room = params.get("room");

document.getElementById("room-title").textContent = "Room: " + room;
const msgBox = document.getElementById("messages");

// Load messages
onValue(ref(db, `messages/${room}`), snap => {
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

      // Delete button
      if (m.sender === window.currentUser.username) {
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.className = "del-btn";
        del.onclick = async () => await remove(ref(db, `messages/${room}/${msgSnap.key}`));
        div.appendChild(del);
      }

      // Reactions bar
      const reactBar = document.createElement("div");
      reactBar.className = "react-bar";
      ["👍","❤️","😂","😮","😢"].forEach(emoji => {
        const btn = document.createElement("button");
        btn.textContent = emoji;
        btn.onclick = async () => {
          const rRef = ref(db, `messages/${room}/${msgSnap.key}/reactions/${window.currentUser.username}`);
          await set(rRef, { emoji, time: Date.now() });
        };
        reactBar.appendChild(btn);
      });
      div.appendChild(reactBar);
    }

    msgBox.appendChild(div);
  });
  msgBox.scrollTop = msgBox.scrollHeight;
});

// Send message
document.getElementById("msg-form").onsubmit = async e => {
  e.preventDefault();
  const user = window.currentUser;
  if (!user) return alert("Not logged in");

  const text = document.getElementById("msg-input").value.trim();
  if (!text) return;
  document.getElementById("msg-input").value = "";

  // Check banned/muted
  const uSnap = await get(ref(db, `users/${user.username}`));
  const u = uSnap.val();
  if (u?.banned || u?.muted) return alert("You are banned or muted!");

  // Command parsing
  if (text.startsWith("?/")) {
    const parts = text.slice(2).split(" ");
    const cmd = parts[0];
    if (cmd === "msg") {
      const target = parts[1];
      const msgText = text.split('"')[1];
      if (!target || !msgText) return alert("Invalid private message");
      push(ref(db, `messages/${room}`), {
        sender: user.username,
        text: msgText,
        time: Date.now(),
        title: user.activeTitle || "",
        private: true,
        target
      });
      return;
    }
    // Further commands like ban/mute can be parsed here based on roles
    return;
  }

  // Normal message
  push(ref(db, `messages/${room}`), {
    sender: user.username,
    text,
    time: Date.now(),
    title: user.activeTitle || ""
  });
};

// Leave room
window.leaveRoom = async () => {
  const u = window.currentUser.username;
  await remove(ref(db, `roomMembers/${room}/${u}`));
  push(ref(db, `messages/${room}`), {
    sender: u,
    text: `[SYSTEM] ${u} has left.`,
    time: Date.now(),
    system: true
  });
  location.href = "dashboard.html";
};

// Remove member on tab close
window.addEventListener("beforeunload", async () => {
  if (window.currentUser) await remove(ref(db, `roomMembers/${room}/${window.currentUser.username}`));
});
