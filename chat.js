import { db } from "./app.js";
import { ref, push, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Parse room from URL
const params = new URLSearchParams(window.location.search);
const room = params.get("room");
document.getElementById("room-title").textContent = "Room: " + room;

const msgBox = document.getElementById("messages");

// ------------------
// ACCOUNT & USER LIST
// ------------------
window.openAccountPopup = function () {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    document.getElementById("displayname-input").value = window.currentUser?.displayName || "";
    popup.style.display = "block";
};

window.closeAccountPopup = function () {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    popup.style.display = "none";
};

window.openUserList = function () {
    const panel = document.getElementById("user-list-panel");
    if (!panel) return;
    panel.style.display = "block";
};

window.closeUserList = function () {
    const panel = document.getElementById("user-list-panel");
    if (!panel) return;
    panel.style.display = "none";
};

// ------------------
// CHECK BAN / MUTE
// ------------------
async function checkBanMute() {
    const u = window.currentUser.username;
    const bannedSnap = await get(ref(db, `roomBans/${room}/${u}`));
    const mutedSnap = await get(ref(db, `roomMutes/${room}/${u}`));
    return { banned: bannedSnap.exists(), muted: mutedSnap.exists() };
}

// ------------------
// JOIN MESSAGE
// ------------------
async function recordJoin() {
    if (!window.currentUser) return;
    const u = window.currentUser.username;
    await set(ref(db, `roomMembers/${room}/${u}`), true);
    push(ref(db, `messages/${room}`), {
        sender: u,
        text: `[SYSTEM] ${u} has joined the room.`,
        time: Date.now(),
        system: true
    });
}

// ------------------
// REMOVE FROM ROOM ON EXIT
// ------------------
window.addEventListener("beforeunload", async () => {
    if (window.currentUser) {
        const u = window.currentUser.username;
        await remove(ref(db, `roomMembers/${room}/${u}`));
        push(ref(db, `messages/${room}`), {
            sender: u,
            text: `[SYSTEM] ${u} has left the room.`,
            time: Date.now(),
            system: true
        });
    }
});

// ------------------
// INITIALIZE
// ------------------
(async () => {
    const status = await checkBanMute();
    if (status.banned) {
        alert("You are banned from this room.");
        window.location.href = "dashboard.html";
    } else {
        await recordJoin();
    }
})();

// ------------------
// LOAD MESSAGES
// ------------------
onValue(ref(db, "messages/" + room), snap => {
    msgBox.innerHTML = "";
    snap.forEach(msgSnap => {
        const m = msgSnap.val();
        const div = document.createElement("div");
        div.className = m.system ? "system-msg" : "chat-msg";

        if (!m.system) {
            div.textContent = `[${m.title||""}] ${m.sender}: ${m.text}`;

            // Delete button for own messages
            if (m.sender === window.currentUser.username) {
                const del = document.createElement("button");
                del.textContent = "✖";
                del.className = "del-btn";
                del.style.cssText = `
                    float: right;
                    background: grey;
                    color: white;
                    border: none;
                    padding: 2px 5px;
                    margin-left: 5px;
                    cursor: pointer;
                    display: none;
                `;
                del.onclick = () => remove(ref(db, `messages/${room}/${msgSnap.key}`));
                div.appendChild(del);

                // Show delete button on hover
                div.onmouseover = () => del.style.display = "inline-block";
                div.onmouseout = () => del.style.display = "none";
            }

            // Reaction button
            const reactBtn = document.createElement("button");
            reactBtn.textContent = "...";
            reactBtn.className = "react-btn";
            reactBtn.onclick = () => {
                const reaction = prompt("Enter reaction emoji:");
                if (!reaction) return;
                push(ref(db, `messages/${room}/${msgSnap.key}/reactions`), {
                    user: window.currentUser.username,
                    emoji: reaction,
                    time: Date.now()
                });
            };
            div.appendChild(reactBtn);
        } else {
            div.textContent = m.text;
        }

        msgBox.appendChild(div);
    });
    msgBox.scrollTop = msgBox.scrollHeight;
});

// ------------------
// SEND MESSAGE
// ------------------
window.sendMessage = async function() {
    if (!window.currentUser) return alert("Not logged in");
    const { muted } = await checkBanMute();
    if (muted) return alert("You are muted in this room");

    const text = document.getElementById("msg-input").value.trim();
    if (!text) return;
    document.getElementById("msg-input").value = "";

    // Command parser
    if (text.startsWith("?/")) {
        const args = text.slice(2).split(" ");
        const cmd = args.shift();
        switch(cmd) {
            case "msg": {
                const target = args.shift();
                const content = args.join(" ").replace(/^"|"$/g,'');
                push(ref(db, `privateMessages/${target}`), {
                    sender: window.currentUser.username,
                    text: content,
                    time: Date.now()
                });
                break;
            }
            case "ban": {
                const target = args.shift();
                set(ref(db, `roomBans/${room}/${target}`), { time: Date.now(), global:false });
                break;
            }
            case "mute": {
                const target = args.shift();
                set(ref(db, `roomMutes/${room}/${target}`), { time: Date.now(), global:false });
                break;
            }
        }
    } else {
        push(ref(db, `messages/${room}`), {
            sender: window.currentUser.username,
            text,
            time: Date.now(),
            title: window.currentUser.activeTitle||""
        });
    }
};

// ------------------
// LEAVE ROOM BUTTON
// ------------------
window.leaveRoom = async () => {
    if (!window.currentUser) return;
    const u = window.currentUser.username;
    await remove(ref(db, `roomMembers/${room}/${u}`));
    push(ref(db, `messages/${room}`), {
        sender: u,
        text: `[SYSTEM] ${u} has left the room.`,
        time: Date.now(),
        system:true
    });
    window.location.href="dashboard.html";
};
