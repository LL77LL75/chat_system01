import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from
  "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCY5_krGDfHcp4ZmUe5RXo7BaKYUQwAM8E",
  authDomain: "chat-app-6767.firebaseapp.com",
  databaseURL: "https://chat-app-6767-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-6767",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

/* ---------- USER ---------- */
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

/* ---------- TAB LEAK PROTECTION ---------- */
if (sessionStorage.getItem("active")) {
  console.warn("Duplicate tab detected");
}
sessionStorage.setItem("active", "1");

window.addEventListener("beforeunload", () => {
  sessionStorage.removeItem("active");
});

/* ---------- LOGIN ---------- */
export async function normalLogin(username, password) {
  const snap = await get(ref(db, `users/${username}`));

  if (!snap.exists() || snap.val().password !== password) {
    alert("Invalid login");
    return;
  }

  const user = snap.val();
  user.username = username;

  localStorage.setItem("currentUser", JSON.stringify(user));
  location.href = "dashboard.html";
}

/* ---------- THEME ---------- */
const savedTheme = localStorage.getItem("theme") || "";
document.body.className = savedTheme;

window.toggleDarkMode = () => {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.className);
};

/* ---------- ROOMS ---------- */
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
  if (!["admin","high","core","pioneer"].includes(currentUser.rank))
    return alert("No permission");

  const name = prompt("Room name?");
  if (name) await set(ref(db, `rooms/${name}`), true);
};

window.logout = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

/* ---------- SAFE AUTH CHECK ---------- */
if (!window.currentUser && !location.pathname.endsWith("index.html")) {
  alert("Session expired");
  location.replace("index.html");
}
