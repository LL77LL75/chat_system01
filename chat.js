import { db } from './app.js';
import { ref, push, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const room = new URLSearchParams(window.location.search).get("room");
const messagesEl = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
document.getElementById("room-title").textContent = `Room: ${room}`;

// Dark mode
if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");
window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

// Send message
window.sendMessage = async () => {
  const text = msgInput.value.trim();
  if (!text) return;
  const mRef = push(ref(db, `messages/${room}`));
  await set(mRef, {
    user: window.currentUser.username,
    text,
    timestamp: Date.now(),
    reactions: {}
  });
  msgInput.value = '';
};

// Listen messages
onValue(ref(db, `messages/${room}`), snap => {
  messagesEl.innerHTML = '';
  snap.forEach(m => {
    const data = m.val();
    const div = document.createElement("div");
    div.className = data.user === "[SYSTEM]" ? "system-msg" : "chat-msg";
    div.dataset.key = m.key;

    const userSpan = document.createElement("strong");
    userSpan.textContent = data.user + ": ";
    div.appendChild(userSpan);

    const textSpan = document.createElement("span");
    textSpan.textContent = data.text;
    div.appendChild(textSpan);

    // Edit
    if (data.user === window.currentUser.username && data.user !== "[SYSTEM]") {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "edit-btn";
      editBtn.onclick = () => {
        const newText = prompt("Edit message:", data.text);
        if (newText) update(ref(db, `messages/${room}/${m.key}`), { text: newText });
      };
      div.appendChild(editBtn);
    }

    // Reactions
    if (data.user !== "[SYSTEM]") {
      const reactDiv = document.createElement("span");
      ["👍","❤️","😂"].forEach(emoji => {
        const rBtn = document.createElement("button");
        rBtn.textContent = emoji + (data.reactions[emoji] || "");
        rBtn.className = "reaction-btn";
        rBtn.onclick = async () => {
          const rRef = ref(db, `messages/${room}/${m.key}/reactions/${emoji}`);
          onValue(rRef, snap => set(rRef, (snap.val()||0)+1), {once:true});
        };
        reactDiv.appendChild(rBtn);
      });
      div.appendChild(reactDiv);
    }

    messagesEl.appendChild(div);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

// System logs
export const systemLog = async text => {
  const sRef = push(ref(db, `messages/${room}`));
  await set(sRef, { user:"[SYSTEM]", text, timestamp:Date.now(), reactions:{} });
};

// Join / Leave
window.joinRoom = async () => {
  await set(ref(db, `roomMembers/${room}/${window.currentUser.username}`), true);
  systemLog(`${window.currentUser.username} joined the room`);
};
window.leaveRoom = async () => {
  await remove(ref(db, `roomMembers/${room}/${window.currentUser.username}`));
  systemLog(`${window.currentUser.username} left the room`);
  location.href="dashboard.html";
};
