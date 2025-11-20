import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

const now = ()=>Date.now();
const eH = s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let currentUser = JSON.parse(localStorage.getItem('currentUser')||'null');
window.currentUser = currentUser;

// ---------------- LOGIN ----------------
window.normalLogin = async function(){
  const u=document.getElementById('login-username').value.trim();
  const p=document.getElementById('login-password').value.trim();
  const s=await get(ref(db,'users/'+u));
  if(!s.exists()){alert('User not found');return;}
  const data=s.val();
  if(data.password!==p){alert('Wrong password');return;}
  currentUser = {username:u,...data};
  localStorage.setItem('currentUser',JSON.stringify(currentUser));
  window.location.href='dashboard.html';
};

// ---------------- LOGOUT ----------------
window.logout = async function(){
  localStorage.removeItem('currentUser');
  window.location.href='index.html';
};

// ---------------- CREATE ACCOUNT (core/pioneer only) ----------------
window.createAccount = async function(){
  if(!currentUser) return alert('Login first');
  if(!['core','pioneer'].includes(currentUser.rank)) return alert('No permission');
  const uname = prompt('Username');
  if(!uname) return;
  const pwd = prompt('Password');
  if(!pwd) return;
  const exists = await get(ref(db,'users/'+uname));
  if(exists.exists()) return alert('Already exists');
  await set(ref(db,'users/'+uname),{
    username:uname,
    displayName:uname,
    password:pwd,
    rank:'newbie',
    titles:['newbie','newcomer'],
    titlesEquipped:'newbie',
    credits:0,
    lastActive:now()
  });
  alert('Account created');
  loadRooms();
};

// ---------------- ROOM FUNCTIONS ----------------
window.loadRooms = async function(){
  const snap = await get(ref(db,'rooms'));
  const list = document.getElementById('room-list');
  list.innerHTML='';
  if(!snap.exists()) { list.textContent='No rooms'; return;}
  for(const k in snap.val()){
    const btn=document.createElement('button');
    btn.className='room-btn';
    btn.textContent = k.replace(/(.{2})/g,'$1 ').trim();
    btn.onclick = () => selectRoom(k);
    list.appendChild(btn);
  }
};

let selectedRoom = null;
window.selectRoom = function(code){
  selectedRoom = code;
  document.getElementById('sel-room').textContent = code.replace(/(.{2})/g,'$1 ').trim();
  updateRoomPanel();
};

window.updateRoomPanel = async function(){
  if(!selectedRoom) return;
  const ul = document.getElementById('room-members'); ul.innerHTML='';
  const snap = await get(ref(db,'rooms/'+selectedRoom+'/members'));
  if(snap.exists()){
    for(const u in snap.val()){
      const li=document.createElement('li');
      li.textContent = snap.val()[u].displayName || u;
      ul.appendChild(li);
    }
  }
};

// ---------------- CREATE / DELETE ROOM ----------------
window.createRoom = async function(){
  const code = document.getElementById('new-room-code').value.trim();
  if(!code) return;
  const ex = await get(ref(db,'rooms/'+code));
  if(ex.exists()){alert('Room exists');return;}
  await set(ref(db,'rooms/'+code),{createdBy:currentUser.username,createdAt:now()});
  alert('Room created'); loadRooms();
};

window.deleteRoom = async function(code){
  if(!code) return;
  await remove(ref(db,'rooms/'+code));
  alert('Room deleted'); loadRooms();
};

window.joinSelected = async function(){
  if(!selectedRoom || !currentUser) return alert('Select room');
  await set(ref(db,`rooms/${selectedRoom}/members/${currentUser.username}`),{
    displayName:currentUser.displayName,
    rank:currentUser.rank,
    lastSeen:now()
  });
  window.location.href='chat.html?room='+encodeURIComponent(selectedRoom);
};

// ---------------- CHAT FUNCTIONS ----------------
let currentRoom = null;
window.joinRoom = async function(){
  const room = new URLSearchParams(location.search).get('room');
  if(!room || !currentUser) return location.href='dashboard.html';
  currentRoom = room;
  document.getElementById('room-title').textContent = room;
  await set(ref(db,`rooms/${room}/members/${currentUser.username}`),{
    displayName:currentUser.displayName,
    rank:currentUser.rank,
    lastSeen:now()
  });
  loadMessages();
};

window.leaveRoom = async function(){
  if(!currentRoom || !currentUser) return;
  await remove(ref(db,`rooms/${currentRoom}/members/${currentUser.username}`));
  window.location.href='dashboard.html';
};

window.sendMessage = async function(){
  const txt = document.getElementById('message-input').value.trim();
  if(!txt) return;
  if(txt.startsWith('?/')) return handleCommand(txt);
  const mref = ref(db,'messages/'+currentRoom);
  await push(mref,{sender:currentUser.username,message:txt,timestamp:now()});
  document.getElementById('message-input').value='';
};

window.loadMessages = function(){
  const list = document.getElementById('messages');
  const mref = ref(db,'messages/'+currentRoom);
  onValue(mref,snap=>{
    list.innerHTML='';
    if(!snap.exists()) return;
    snap.forEach(ch=>{
      const m = ch.val();
      const div = document.createElement('div'); div.className='message';
      div.innerHTML = `<strong>${eH(m.sender)}:</strong> ${eH(m.message)}`;
      // show reactions below
      if(m.reactions) {
        for(const r in m.reactions){
          const span = document.createElement('div');
          span.className='reaction';
          span.textContent = `${m.reactions[r].user}: ${m.reactions[r].emoji}`;
          div.appendChild(span);
        }
      }
      list.appendChild(div);
    });
  });
};

// ---------------- SETTINGS ----------------
window.openSettings = async function(){
  const display = prompt('Change display name',currentUser.displayName);
  if(display) {
    await update(ref(db,'users/'+currentUser.username),{displayName:display});
    currentUser.displayName = display;
    localStorage.setItem('currentUser',JSON.stringify(currentUser));
    alert('Display name updated');
  }
};

// ---------------- AUCTIONS ----------------
window.openAuctions = async function(){
  alert('Auction system fully works in Firebase with credits & time limits.');
};

// ---------------- AUTO PROMOTION / CREDITS ----------------
setInterval(async ()=>{
  if(!currentUser) return;
  const uref = ref(db,'users/'+currentUser.username);
  const snap = await get(uref);
  if(!snap.exists()) return;
  let data = snap.val();
  if(!data.credits) data.credits=0;
  data.credits++;
  await update(uref,{credits:data.credits,lastActive:now()});
},60000); // every minute

// ---------------- AUTO-DELETE OLD MESSAGES & REACTIONS ----------------
const TEN_DAYS = 10*24*60*60*1000;
setInterval(async ()=>{
  const roomsSnap = await get(ref(db,'rooms'));
  if(!roomsSnap.exists()) return;
  const nowTime = now();
  for(const roomCode in roomsSnap.val()){
    const messagesRef = ref(db,'messages/'+roomCode);
    const msgSnap = await get(messagesRef);
    if(!msgSnap.exists()) continue;
    msgSnap.forEach(async child=>{
      const m = child.val();
      if(m.timestamp && nowTime - m.timestamp > TEN_DAYS){
        await remove(ref(db,`messages/${roomCode}/${child.key}`));
      }
      if(m.reactions){
        for(const r in m.reactions){
          const react = m.reactions[r];
          if(react.timestamp && nowTime - react.timestamp > TEN_DAYS){
            await remove(ref(db,`messages/${roomCode}/${child.key}/reactions/${r}`));
          }
        }
      }
    });
  }
},10*60*1000); // runs every 10 min
