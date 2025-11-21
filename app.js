import { db } from './firebase-config.js';
import { ref, push, onValue } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

const params = new URLSearchParams(window.location.search);
const roomCode = params.get("room");

function getMessagesRef() {
    return ref(db, `messages/${roomCode}`);
}

export async function sendMessage() {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if (!msg) return;
    await push(getMessagesRef(), {
        sender: window.currentUser.displayName,
        message: msg,
        timestamp: Date.now()
    });
    input.value = "";
}

export function loadMessages() {
    onValue(getMessagesRef(), snapshot => {
        const container = document.getElementById("messages");
        container.innerHTML = "";
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement("div");
            div.textContent = `[${msg.sender}]: ${msg.message}`;
            container.appendChild(div);
        });
    });
}

window.addEventListener("load", loadMessages);
window.sendMessage = sendMessage;
