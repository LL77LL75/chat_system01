import { db } from './firebase-config.js';
import { ref, get, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
const roomCode = new URLSearchParams(window.location.search).get('room');
const messagesDiv = document.getElementById('messages');

async function joinRoom(){
    const memberRef = ref(db, `rooms/${roomCode}/members/${window.currentUser.username}`);
    await set(memberRef,{joined:Date.now()});
    addSystemMessage(`${window.currentUser.displayName||window.currentUser.username} has joined the chat`);
}
async function leaveRoom(){
    const memberRef = ref(db, `rooms/${roomCode}/members/${window.currentUser.username}`);
    await remove(memberRef);
    addSystemMessage(`${window.currentUser.displayName||window.currentUser.username} has left the chat`);
}
window.leaveRoom = leaveRoom;

window.sendMessage = async function(){
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if(!message) return;
    const messagesRef = ref(db,`messages/${roomCode}`);
    await push(messagesRef,{
        sender:window.currentUser.username,
        message,
        timestamp:Date.now()
    });
    input.value='';
};

function addSystemMessage(msg){
    const div = document.createElement('div');
    div.className='message';
    div.style.color='gray';
    div.textContent=msg;
    messagesDiv.appendChild(div);
}

function renderMessage(msgData,key){
    const div = document.createElement('div');
    div.className='message';
    const senderName = msgData.sender===window.currentUser.username?window.currentUser.displayName||window.currentUser.username:msgData.sender;
    div.innerHTML=`[${senderName}]: ${msgData.message}`;
    messagesDiv.appendChild(div);
}

// ------------------------
// Load messages and reactions
// ------------------------
const messagesRef = ref(db, `messages/${roomCode}`);
onValue(messagesRef,snap=>{
    messagesDiv.innerHTML='';
    snap.forEach(child=>{
        renderMessage(child.val(),child.key);
    });
});

// ------------------------
// Auto cleanup messages >10days
// ------------------------
async function cleanupMessages(){
    const snap = await get(messagesRef);
    if(!snap.exists()) return;
    const tenDays = Date.now()-10*24*60*60*1000;
    snap.forEach(child=>{
        if(child.val().timestamp<tenDays) remove(ref(db,`messages/${roomCode}/${child.key}`));
    });
}
setInterval(cleanupMessages,60000);

// ------------------------
// Initialize
// ------------------------
window.addEventListener('load',joinRoom);
window.addEventListener('beforeunload',leaveRoom);
