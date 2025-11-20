import { db, ref, push, onValue, get, set, update } from './firebase-config.js';

const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
const roomCode = new URLSearchParams(window.location.search).get("room");

if(!currentUser.username || !roomCode) {
    alert("Invalid session");
    window.location.href = "index.html";
}

// -------------------- Room Join --------------------
const roomMembersRef = ref(db, `rooms/${roomCode}/members/${currentUser.username}`);
set(roomMembersRef, {joinedAt: Date.now(), rank: currentUser.rank});

// Push join message
const messagesRef = ref(db, `messages/${roomCode}`);
push(messagesRef, {
    sender: currentUser.username,
    message: getJoinMessage(currentUser.rank, currentUser.displayName),
    timestamp: Date.now(),
    system:true
});

// -------------------- Room Leave --------------------
window.addEventListener("beforeunload", async ()=>{
    const roomMembersRef = ref(db, `rooms/${roomCode}/members/${currentUser.username}`);
    await set(roomMembersRef, null);

    // Push leave message
    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, {
        sender: currentUser.username,
        message: getLeaveMessage(currentUser.rank, currentUser.displayName),
        timestamp: Date.now(),
        system:true
    });
});

// -------------------- Join/Leave Message Generators --------------------
function getJoinMessage(rank, name){
    if(["newbie","member","admin"].includes(rank)) return `${name} has joined the chat`;
    if(["high","core"].includes(rank)) return `${name} joins the chat...`;
    if(rank === "pioneer") return "A GOD HAS ARRIVED";
    return `${name} has joined`;
}

function getLeaveMessage(rank, name){
    if(["newbie","member","admin"].includes(rank)) return `${name} has left the chat`;
    if(["high","core"].includes(rank)) return `${name} leaves the chat...`;
    if(rank === "pioneer") return `${name} has left`;
    return `${name} has left`;
}

// -------------------- Load Messages --------------------
const messagesContainer = document.getElementById("messages");
const messagesRefRoom = ref(db, `messages/${roomCode}`);

onValue(messagesRefRoom, snapshot=>{
    messagesContainer.innerHTML="";
    snapshot.forEach(child=>{
        const msg = child.val();
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("message");

        // System messages gray
        if(msg.system) msgDiv.style.color="#888";

        let text = msg.system ? msg.message : `[${msg.sender}]: ${msg.message}`;
        if(msg.hidden) text += " (hidden)";

        msgDiv.innerHTML = text;

        // Reactions
        if(msg.reactions){
            const rDiv = document.createElement("div");
            rDiv.style.fontSize="smaller";
            for(const [rUser, rVal] of Object.entries(msg.reactions)){
                rDiv.innerHTML += `${rUser}: ${rVal} `;
            }
            msgDiv.appendChild(rDiv);
        }

        messagesContainer.appendChild(msgDiv);
    });
});

// -------------------- Reactions --------------------
window.reactMessage = async function(messageKey, reaction){
    const msgRef = ref(db, `messages/${roomCode}/${messageKey}/reactions/${currentUser.username}`);
    await set(msgRef, reaction);
};

// -------------------- Commands --------------------
window.sendCommand = async function(cmdText){
    const parts = cmdText.trim().split(" ");
    const cmd = parts[0];
    const args = parts.slice(1);

    switch(cmd){
        case "?/msg":
            if(!["member","admin","high","core","pioneer"].includes(currentUser.rank)) return alert("Cannot send private message");
            const targetUser = args[0];
            const message = args.slice(1).join(" ").replace(/["]+/g,"");
            const pmRef = ref(db, `pm/${targetUser}/${Date.now()}`);
            await set(pmRef, {from:currentUser.username, message, hidden:true});
            break;
        case "?/ban":
        case "?/mute":
        case "?/unban":
        case "?/unmute":
        case "?/kick":
            if(!["admin","high","core","pioneer"].includes(currentUser.rank)) return alert("Insufficient rank");
            // TODO: implement levels/scope based on rank
            break;
        case "?/auction":
            if(!args.length) return alert("Usage ?/auction [title] [startbid] [time]");
            const title = args[0].replace(/["]+/g,"");
            const startBid = parseInt(args[1]);
            const timeMinutes = parseInt(args[2]);
            await window.startAuction(title,startBid,timeMinutes);
            break;
        case "?/give":
            if(!["pioneer"].includes(currentUser.rank)) return alert("Cannot give");
            // TODO: implement credit/title giving
            break;
        case "?/rank":
            if(!["pioneer"].includes(currentUser.rank)) return alert("Cannot rank");
            const target = args[0];
            const newRank = args[1];
            const targetRef = ref(db, `users/${target}/rank`);
            await set(targetRef, newRank);
            break;
        default:
            console.log("Unknown command");
    }
};

// -------------------- Load Room Members --------------------
const membersPanel = document.getElementById("members-panel");
onValue(ref(db, `rooms/${roomCode}/members`), snapshot=>{
    membersPanel.innerHTML="<b>Members:</b><br>";
    snapshot.forEach(child=>{
        membersPanel.innerHTML += child.key + "<br>";
    });
});

const bannedPanel = document.getElementById("banned-panel");
const mutedPanel = document.getElementById("muted-panel");
if(["admin","high","core","pioneer"].includes(currentUser.rank)){
    onValue(ref(db, `rooms/${roomCode}/bans`), snapshot=>{
        bannedPanel.innerHTML="<b>Banned:</b><br>";
        snapshot.forEach(child=>bannedPanel.innerHTML+=`${child.key}<br>`);
    });
    onValue(ref(db, `rooms/${roomCode}/mutes`), snapshot=>{
        mutedPanel.innerHTML="<b>Muted:</b><br>";
        snapshot.forEach(child=>mutedPanel.innerHTML+=`${child.key}<br>`);
    });
}
