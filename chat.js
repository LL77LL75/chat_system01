import { db } from './app.js';
import { ref, push, set, onValue, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const room = new URLSearchParams(window.location.search).get("room");
document.getElementById("room-title").textContent = `Room: ${room}`;

const messagesEl = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");

// Persistent dark mode
if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");
window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

// Send message
window.sendMessage = async () => {
  const msg = msgInput.value.trim();
  if (!msg) return;
  const mRef = push(ref(db, `messages/${room}`));
  await set(mRef, {
    user: window.currentUser.username,
    text: msg,
    timestamp: Date.now(),
    reactions: {}
  });
  msgInput.value = '';
};

// Listen to messages
onValue(ref(db, `messages/${room}`), snap => {
  messagesEl.innerHTML = '';
  snap.forEach(m => {
    const data = m.val();
    const msgDiv = document.createElement("div");
    msgDiv.className = data.user === "[SYSTEM]" ? "system-msg" : "chat-msg";
    msgDiv.dataset.key = m.key;

    const usernameSpan = document.createElement("strong");
    usernameSpan.textContent = data.user + ": ";
    msgDiv.appendChild(usernameSpan);

    const textSpan = document.createElement("span");
    textSpan.textContent = data.text;
    msgDiv.appendChild(textSpan);

    // Edit button for own messages
    if (data.user === window.currentUser.username && data.user !== "[SYSTEM]") {
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "edit-btn";
      editBtn.onclick = () => editMessage(m.key, data.text);
      msgDiv.appendChild(editBtn);
    }

    // Reactions
    if (data.user !== "[SYSTEM]") {
      const reactionsDiv = document.createElement("span");
      ["👍", "❤️", "😂"].forEach(emoji => {
        const rBtn = document.createElement("button");
        rBtn.textContent = emoji + (data.reactions[emoji] || "");
        rBtn.className = "reaction-btn";
        rBtn.onclick = () => addReaction(m.key, emoji);
        reactionsDiv.appendChild(rBtn);
      });
      msgDiv.appendChild(reactionsDiv);
    }

    messagesEl.appendChild(msgDiv);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

// Edit message
const editMessage = (key, currentText) => {
  const newText = prompt("Edit your message:", currentText);
  if (!newText) return;
  update(ref(db, `messages/${room}/${key}`), { text: newText });
};

// Add reaction
const addReaction = async (key, emoji) => {
  const refMsg = ref(db, `messages/${room}/${key}/reactions/${emoji}`);
  onValue(refMsg, snap => {
    const val = snap.val() || 0;
    set(refMsg, val + 1);
  }, { once: true });
};

// SYSTEM messages
export const systemLog = async (text) => {
  const sRef = push(ref(db, `messages/${room}`));
  await set(sRef, { user: "[SYSTEM]", text, timestamp: Date.now(), reactions: {} });
};

// Example: log when someone joins
window.joinRoom = async () => {
  await set(ref(db, `roomMembers/${room}/${window.currentUser.username}`), true);
  systemLog(`${window.currentUser.username} joined the room`);
};
window.leaveRoom = async () => {
  await ref(db, `roomMembers/${room}/${window.currentUser.username}`).remove();
  systemLog(`${window.currentUser.username} left the room`);
  location.href = "dashboard.html";
};
