import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Credits & Rank Promotion (every 1 min)
// ------------------------
const rankConfig = {
    newbie: {interval: 60000, timeout: 900000, promoteAt: 30, nextRank: 'member'},
    member: {interval: 300000, timeout: 1800000, promoteAt: 100, nextRank: 'admin'},
    admin: {interval: 900000, timeout: 7200000, promoteAt: 300, nextRank: 'high'},
    high: {interval: 1200000, timeout: 18000000, promoteAt: 500, nextRank: 'core'},
    core: {interval: 2700000, timeout: 0, promoteAt: 0, nextRank: 'pioneer'},
    pioneer: {interval: 0, timeout: 0, promoteAt: 0}
};

async function checkCredits() {
    if (!window.currentUser.rank) return;
    const cfg = rankConfig[window.currentUser.rank];
    if(!cfg) return;

    window.currentUser.credits = window.currentUser.credits || 0;
    window.currentUser.lastActive = window.currentUser.lastActive || Date.now();
    const elapsed = Date.now() - window.currentUser.lastActive;
    if(cfg.timeout && elapsed > cfg.timeout) return; // Timeout no credits
    window.currentUser.credits += 1;

    // Update Firebase
    await update(ref(db, `users/${window.currentUser.username}`), { credits: window.currentUser.credits });

    // Rank promotion
    if(cfg.promoteAt && window.currentUser.credits >= cfg.promoteAt){
        const next = cfg.nextRank;
        window.currentUser.rank = next;
        window.currentUser.credits = 0;
        await update(ref(db, `users/${window.currentUser.username}`), { rank: next, credits: 0 });
        alert(`You have been promoted to ${next}`);
    }
}

// Start credits interval
setInterval(checkCredits, 60000);

// ------------------------
// Reactions
// ------------------------
export async function addReaction(msgId, reaction) {
    const msgRef = ref(db, `messages/${window.roomCode}/${msgId}/reactions`);
    const snap = await get(msgRef);
    let arr = snap.exists() ? snap.val() : [];
    arr.push(`${window.currentUser.username}:${reaction}`);
    await set(msgRef, arr);
}

// ------------------------
// Auction System
// ------------------------
export async function startAuction(title, startingBid, durationMs) {
    if(!title || !startingBid || !durationMs) return;
    const auctionRef = ref(db, `auctions/${window.roomCode}`);
    await set(auctionRef, {
        title, 
        currentBid: startingBid, 
        highestBidder: null, 
        startedBy: window.currentUser.username, 
        startTime: Date.now(), 
        endTime: Date.now()+durationMs
    });
    alert(`Auction started for "${title}"`);
}

// ------------------------
// Messaging
// ------------------------
window.roomCode = new URLSearchParams(window.location.search).get("room");
const messagesRef = ref(db, `messages/${window.roomCode}`);
const messagesContainer = document.getElementById('messages');

onValue(messagesRef, snapshot => {
    messagesContainer.innerHTML = '';
    snapshot.forEach(child => {
        const msg = child.val();
        const div = document.createElement('div');
        div.classList.add('message');
        if(msg.sender === 'SYSTEM') {
            div.style.color = 'gray';
            div.textContent = msg.message;
        } else {
            div.textContent = `[${msg.sender}]: ${msg.message}`;
            if(msg.reactions && msg.reactions.length){
                div.innerHTML += `<br><small>${msg.reactions.map(r=>r.replace(':', ' reacted: ')).join(", ")}</small>`;
            }
            div.onclick = () => {
                const r = prompt('React to this message with emoji/text:');
                if(r) addReaction(child.key, r);
            }
        }
        messagesContainer.appendChild(div);
    });
});

// Send chat message
window.sendMessage = async function(){
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if(!message) return;
    await push(messagesRef, {
        sender: window.currentUser.username,
        message,
        timestamp: Date.now(),
        reactions: []
    });
    input.value = '';
};

// Leave chat (push SYSTEM leave message)
window.addEventListener('beforeunload', async ()=>{
    await push(messagesRef, {
        sender: 'SYSTEM',
        message: `[${window.currentUser.displayName || window.currentUser.username}] has left the chat`,
        timestamp: Date.now()
    });
});
