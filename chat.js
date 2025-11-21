import { db } from './firebase-config.js';
import { ref, push, onValue, remove, get, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
window.roomCode = new URLSearchParams(window.location.search).get("room");
document.getElementById("room-header").textContent = "Room: " + window.roomCode;

// ------------------------
// Join Message
// ------------------------
async function sendJoinMessage() {
    const msgRef = ref(db, `messages/${window.roomCode}`);
    let text = "";
    switch(window.currentUser.rank){
        case "pioneer": text = "A GOD HAS ARRIVED"; break;
        case "core":
        case "high": text = `${window.currentUser.displayName || window.currentUser.username} joins the chat...`; break;
        default: text = `${window.currentUser.displayName || window.currentUser.username} has joined the chat`; break;
    }
    await push(msgRef, { sender: "system", message: text, timestamp: Date.now() });
}
sendJoinMessage();

// ------------------------
// Leave Message
// ------------------------
window.addEventListener("beforeunload", async ()=>{
    const msgRef = ref(db, `messages/${window.roomCode}`);
    let text = "";
    switch(window.currentUser.rank){
        case "pioneer": text = `${window.currentUser.displayName || window.currentUser.username} has left`; break;
        case "core":
        case "high": text = `${window.currentUser.displayName || window.currentUser.username} leaves the chat...`; break;
        default: text = `${window.currentUser.displayName || window.currentUser.username} has left the chat`; break;
    }
    await push(msgRef, { sender: "system", message: text, timestamp: Date.now() });
});

// ------------------------
// Send Chat Message
// ------------------------
window.sendMessage = async function(){
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if(!msg) return;

    const msgRef = ref(db, `messages/${window.roomCode}`);
    await push(msgRef, { sender: window.currentUser.username, message: msg, timestamp: Date.now() });
    input.value = "";
};

// ------------------------
// Load Messages
// ------------------------
window.loadMessages = function(){
    const messagesContainer = document.getElementById("messages");
    const messagesRef = ref(db, `messages/${window.roomCode}`);

    onValue(messagesRef, snapshot=>{
        messagesContainer.innerHTML = "";
        snapshot.forEach(child=>{
            const m = child.val();
            const div = document.createElement("div");
            div.classList.add("message");

            if(m.sender === "system"){
                div.style.color = "gray";
                div.textContent = `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.message}`;
            } else if(["core","pioneer"].includes(window.currentUser.rank) && m.private){
                div.textContent = `[${m.sender} -> You]: ${m.message} (hidden)`;
            } else {
                div.textContent = `[${m.sender}]: ${m.message}`;
            }

            messagesContainer.appendChild(div);

            // Display reactions below the message
            if(m.reactions){
                const reactDiv = document.createElement("div");
                reactDiv.style.fontSize = "smaller";
                reactDiv.textContent = "Reactions: " + Object.entries(m.reactions).map(([user, r])=>`${user}: ${r}`).join(", ");
                messagesContainer.appendChild(reactDiv);
            }
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
};
window.loadMessages();
