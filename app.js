import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, set, push, remove, onValue, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  databaseURL: "YOUR_DB_URL",
  projectId: "YOUR_PROJECT_ID",
};
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Dark mode
if(localStorage.getItem("darkMode")==="true") document.body.classList.add("dark");
window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

// User info placeholder
window.currentUser = { username:"User1", isAdmin:true };

// Account popup
window.openAccountPopup = ()=>document.getElementById("account-popup").style.display="block";
window.closeAccountPopup = ()=>document.getElementById("account-popup").style.display="none";

// Rooms
const roomList = document.getElementById("room-list");
const roomInfoPanel = document.getElementById("room-info-panel");
const usersInside = document.getElementById("users-inside");
const usersBanned = document.getElementById("users-banned");
const usersMuted = document.getElementById("users-muted");

export async function loadRooms() {
  onValue(ref(db, "rooms"), snap=>{
    roomList.innerHTML="";
    snap.forEach(r=>{
      const btn = document.createElement("button");
      btn.textContent=r.key;
      btn.onclick=()=>loadRoomInfo(r.key);
      roomList.appendChild(btn);
    });
  });
}

window.addRoom = async () => {
  if(!window.currentUser.isAdmin) return alert("Admin only");
  const name=prompt("Room name:");
  if(name) await set(ref(db, `rooms/${name}`), true);
};

window.deleteRoom = async () => {
  if(!window.currentUser.isAdmin) return alert("Admin only");
  const roomName = document.getElementById("current-room-title").textContent;
  if(roomName && confirm("Delete room?")) await remove(ref(db, `rooms/${roomName}`));
  roomInfoPanel.style.display="none";
};

// Load info
window.loadRoomInfo = (roomName)=>{
  document.getElementById("current-room-title").textContent=roomName;
  roomInfoPanel.style.display="block";
  const membersRef = ref(db, `roomMembers/${roomName}`);
  onValue(membersRef, snap=>{
    usersInside.innerHTML="<strong>Inside:</strong>";
    snap.forEach(u=>{
      const li=document.createElement("li");
      li.textContent=u.key;
      if(window.currentUser.isAdmin){
        const mute = document.createElement("button"); mute.textContent="Mute"; mute.onclick=()=>muteUser(roomName,u.key);
        const ban = document.createElement("button"); ban.textContent="Ban"; ban.onclick=()=>banUser(roomName,u.key);
        li.appendChild(mute); li.appendChild(ban);
      }
      usersInside.appendChild(li);
    });
  });
};

// Mute/ban
window.muteUser = async (room,user)=>update(ref(db,`muted/${room}/${user}`),true);
window.banUser = async (room,user)=>{
  await update(ref(db,`banned/${room}/${user}`),true);
  await remove(ref(db,`roomMembers/${room}/${user}`));
};

// Join room
window.joinRoom = async ()=>{
  const roomName = document.getElementById("current-room-title").textContent;
  if(!roomName) return;
  await set(ref(db, `roomMembers/${roomName}/${window.currentUser.username}`), true);
  systemLog(roomName,`${window.currentUser.username} joined the room`);
};

// System logs
export async function systemLog(room,msg){
  const sRef=push(ref(db,`messages/${room}`));
  await set(sRef,{user:"[SYSTEM]",text:msg,timestamp:Date.now(),reactions:{}});
}

// Initial load
loadRooms();
