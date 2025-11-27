// uwu
import { db } from "./app.js";
import { ref, get, set, push, remove, onChildAdded } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

let room = null;
let currentUser = window.currentUser || null;

// -------------------------------
// INIT
// -------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Get room from URL
  const params = new URLSearchParams(window.location.search);
  room = params.get("room");

  if (!room) {
    alert("No room specified.");
    return;
  }

  currentUser = window.currentUser;
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  // Set room name
  document.getElementById("roomName").innerText = room;

  // Join room
  joinRoom(currentUser.username, room);

  // Load chat messages
  loadMessages();

  // Send button
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  document.getElementById("chatInput").addEventListener("keyup", e => {
    if (e.key === "Enter") sendMessage();
  });
});

// -------------------------------
// JOIN ROOM
// -------------------------------
async function joinRoom(username, roomId) {
  await set(ref(db, `rooms/${roomId}/members/${username}`), true);

  await push(ref(db, `rooms/${roomId}/messages`), {
    sender: "SYSTEM",
    text: `${username} has joined the chat.`,
    time: Date.now(),
    system: true
  });
}

// -------------------------------
// LEAVE ROOM
// -------------------------------
function leaveRoomCmd() {
  if (!currentUser || !room) return;

  (async () => {
    const username = currentUser.username;

    // System leave message
    await push(ref(db, `rooms/${room}/messages`), {
      sender: "SYSTEM",
      text: `${username} has left the chat.`,
      time: Date.now(),
      system: true
    });

    // Remove from members
    await remove(ref(db, `rooms/${room}/members/${username}`));

    // Redirect
    window.location.href = "dashboard.html";
  })();
}
window.leaveRoomCmd = leaveRoomCmd;

// -------------------------------
// LOAD MESSAGES
// -------------------------------
function loadMessages() {
  const msgsRef = ref(db, `rooms/${room}/messages`);
  const msgBox = document.getElementById("messages");

  onChildAdded(msgsRef, snap => {
    const m = snap.val();
    const div = document.createElement("div");

    if (m.system) {
      div.className = "message system";
      div.innerText = `[SYSTEM] ${m.text}`;
    } else {
      div.className = "message";
      div.innerHTML = `<strong>${m.sender}:</strong> ${m.text}`;
    }

    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  });
}

// -------------------------------
// SEND MESSAGE
// -------------------------------
async function sendMessage() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;

  // Prevent muted users from sending messages
  if (currentUser.muted) {
    alert("You are muted and cannot send messages.");
    return;
  }

  await push(ref(db, `rooms/${room}/messages`), {
    sender: currentUser.username,
    text,
    time: Date.now()
  });

  input.value = "";
}
