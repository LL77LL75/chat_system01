import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCY5_krGDfHcp4ZmUe5RXo7BaKYUQwAM8E",
  authDomain: "chat-app-6767.firebaseapp.com",
  databaseURL: "https://chat-app-6767-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-6767",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

/* THEME PERSISTENCE (GLOBAL) */
const savedTheme = localStorage.getItem("theme") || "";
document.body.className = savedTheme;

window.toggleDarkMode = () => {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.className);
};

/* ROOMS */
window.loadRooms = () => {
  const list = document.getElementById("room-list");
  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    snap.forEach(r => {
      const b = document.createElement("button");
      b.className = "room-btn";
      b.textContent = r.key;
      b.onclick = () => location.href = `chat.html?room=${r.key}`;
      list.appendChild(b);
    });
  });
};

window.addRoom = async () => {
  if (currentUser.rank !== "admin" && currentUser.rank !== "high" &&
      currentUser.rank !== "core" && currentUser.rank !== "pioneer")
    return alert("No permission");

  const name = prompt("Room name?");
  if (name) await set(ref(db, `rooms/${name}`), true);
};

window.onload = () => {
  if (!currentUser) location.href = "index.html";
  loadRooms();
};
