// chat.js
import { db } from './firebase-config.js';
import { ref, push, onValue, update, get, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// -----------------------
// Utility to get room code from URL
// -----------------------
function getRoomCode() {
  return new URLSearchParams(window.location.search).get("room") || "global";
}

// -----------------------
// Show join/leave messages depending on rank
// -----------------------
async function announceJoinLeave(user, action) {
  const messagesRef = ref(db, `messages/${getRoomCode()}`);
  const rank = user.rank || "newbie";
  let text = "";
  if (action === "join") {
    if (["newbie","member","admin"].includes(rank)) text = `[${user.displayName}] has joined the chat`;
    else if (["high","core"].includes(rank)) text = `[${user.displayName}] joins the chat...`;
    else text = `A GOD HAS ARRIVED`;
  } else {
    if (["newbie","member","admin"].includes(rank)) text = `[${user.displayName}] has left the chat`;
    else if (["high","core"].includes(rank)) text = `[${user.displayName}] leaves the chat...`;
    else text = `[${user.displayName}] has left`;
  }
  await push(messagesRef, { sender: "system", message: text, timestamp: Date.now(), type: "system" });
}

// -----------------------
// Send chat message
// -----------------------
window.sendMessage = async function() {
  const input = document.getElementById("message-input");
  const msg = input.value.trim();
  if (!msg) return;
  const roomCode = getRoomCode();
  const messagesRef = ref(db, `messages/${roomCode}`);
  await push(messagesRef, { sender: window.currentUser.username, displayName: window.currentUser.displayName, message: msg, timestamp: Date.now() });
  input.value = "";
};

// -----------------------
// Load messages
// -----------------------
window.loadMessages = function() {
  const roomCode = getRoomCode();
  const messagesRef = ref(db, `messages/${roomCode}`);
  const messagesContainer = document.getElementById("messages");
  messagesContainer.innerHTML = "";

  onValue(messagesRef, snapshot => {
    messagesContainer.innerHTML = "";
    snapshot.forEach(child => {
      const msg = child.val();
      const div = document.createElement("div");
      div.className = "message";
      if(msg.type === "system") div.style.color = "gray";
      div.innerHTML = `[${msg.displayName || msg.sender}]: ${msg.message}`;
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
};

// -----------------------
// Join room
// -----------------------
window.joinSelected = async function() {
  const roomCode = getRoomCode();
  const roomRef = ref(db, `rooms/${roomCode}/members/${window.currentUser.username}`);
  await set(roomRef, { displayName: window.currentUser.displayName, rank: window.currentUser.rank });
  await announceJoinLeave(window.currentUser, "join");
  alert(`Joined room ${roomCode}!`);
  loadMessages();
};

// -----------------------
// Leave room
// -----------------------
window.leaveRoom = async function() {
  const roomCode = getRoomCode();
  const roomRef = ref(db, `rooms/${roomCode}/members/${window.currentUser.username}`);
  await remove(roomRef);
  await announceJoinLeave(window.currentUser, "leave");
  window.location.href = "dashboard.html";
};

// -----------------------
// Track join/leave in dashboard for room info
// -----------------------
window.loadRoomInfo = async function(roomCode) {
  const infoContainer = document.getElementById("room-info");
  const roomMembersRef = ref(db, `rooms/${roomCode}/members`);
  onValue(roomMembersRef, snapshot => {
    let html = "";
    snapshot.forEach(child => {
      const u = child.val();
      html += `<div>${u.displayName} (${u.rank})</div>`;
    });
    infoContainer.innerHTML = html || "No one is in this room yet.";
  });
};

// -----------------------
// Auto run on load
// -----------------------
window.addEventListener("load", () => {
  if (window.location.pathname.includes("chat.html")) {
    loadMessages();
  }
});
