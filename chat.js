import { 
  db, auth,
  ref, get, push, set, remove, onChildAdded
} from "./firebase-config.js";

let room = null;
let currentUser = null;
window.currentUser = null;

// -------------------------------
// INIT
// -------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  // Get room from URL
  const params = new URLSearchParams(window.location.search);
  room = params.get("room");

  if (!room) {
    alert("No room specified.");
    return;
  }

  // Load user
  await loadCurrentUser();
  if (!currentUser) {
    window.location.href = "index.html";
    return;
  }

  window.currentUser = currentUser;

  // Set room name
  document.getElementById("roomName").innerText = room;

  // Join room
  await joinRoom(currentUser.username, room);

  // Load chat messages
  loadMessages();

  // Send button
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  document.getElementById("chatInput").addEventListener("keyup", e => {
    if (e.key === "Enter") sendMessage();
  });
});

// -------------------------------
// LOAD CURRENT USER
// -------------------------------
async function loadCurrentUser() {
  const u = auth.currentUser;
  if (!u) return;

  const snap = await get(ref(db, `users/${u.uid}`));
  if (!snap.exists()) return;

  currentUser = snap.val();
}

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
// LEAVE ROOM  (FULLY PATCHED)
// -------------------------------
function leaveRoomCmd() {
  if (!window.currentUser || !room) return;

  (async () => {
    const username = window.currentUser.username;

    // System leave message
    await push(ref(db, `rooms/${room}/messages`), {
      sender: "SYSTEM",
      text: `${username} has left the chat.`,
      time: Date.now(),
      system: true
    });

    // Remove from room members
    await remove(ref(db, `rooms/${room}/members/${username}`));

    // Redirect
    window.location.href = "dashboard.html";
  })();
}

// Make globally available
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

  await push(ref(db, `rooms/${room}/messages`), {
    sender: currentUser.username,
    text,
    time: Date.now()
  });

  input.value = "";
}
