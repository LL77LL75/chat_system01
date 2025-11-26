import { db } from "./app.js";
import { ref, push, onValue, remove, set, update, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const room = params.get("room");
document.getElementById("room-title").textContent = "Room: " + room;

const msgBox = document.getElementById("messages");

function addMessageDiv(m,key){
    const div=document.createElement("div");
    div.dataset.key=key;
    if(m.system){div.className="system-msg"; div.textContent=m.text;}
    else{
        let t = m.title ? `[${m.title}] ${m.sender}: ${m.text}` : `${m.sender}: ${m.text}`;
        div.textContent=t;

        if(m.sender===window.currentUser.username){
            const delBtn=document.createElement("button");
            delBtn.textContent="Delete";
            delBtn.onclick=()=>remove(ref(db,`messages/${room}/${key}`));
            div.appendChild(document.createElement("br"));
            div.appendChild(delBtn);
        }

        const reactBtn=document.createElement("button");
        reactBtn.textContent="...";
        reactBtn.onclick=()=>{
            const emoji=prompt("Enter reaction:");
            if(!emoji) return;
            push(ref(db,`messages/${room}/${key}/reactions`),{user:window.currentUser.username,emoji,time:Date.now()});
        };
        div.appendChild(reactBtn);
    }
    msgBox.appendChild(div);
}

onValue(ref(db,`messages/${room}`),snap=>{
    msgBox.innerHTML="";
    snap.forEach(msgSnap=>addMessageDiv(msgSnap.val(),msgSnap.key));
    msgBox.scrollTop=msgBox.scrollHeight;
});

window.sendMessage=async function(){
    const user=window.currentUser;
    if(!user) return alert("Not logged in.");
    const mutedSnap = await get(ref(db,`users/${user.username}/muted`));
    if(mutedSnap.exists()) return alert("You are muted and cannot chat.");

    let text=document.getElementById("msg-input").value.trim();
    if(!text) return;
    document.getElementById("msg-input").value="";

    if(text.startsWith("?/")){
        const parts=text.split(" ");
        const cmd=parts[0];
        const rank=user.rank;
        switch(cmd){
            case "?/msg":
                const target=parts[1];
                const content=text.split('"')[1];
                push(ref(db,`users/${target}/privateMessages`),{from:user.username,text:content,time:Date.now()});
                return;
            case "?/ban":
                if(!["admin","high","core","pioneer"].includes(rank)) return alert("No permission");
                const targetBan=parts[1]; const level=parts[2]||1;
                update(ref(db,`users/${targetBan}/banned`),{[user.username]:parseInt(level)});
                push(ref(db,`messages/${room}`),{sender:"SYSTEM",text:`${targetBan} banned at level ${level}`,system:true,time:Date.now()});
                return;
            case "?/mute":
                if(!["admin","high","core","pioneer"].includes(rank)) return alert("No permission");
                const targetMute=parts[1]; const lvl=parts[2]||1;
                update(ref(db,`users/${targetMute}/muted`),{[user.username]:parseInt(lvl)});
                push(ref(db,`messages/${room}`),{sender:"SYSTEM",text:`${targetMute} muted at level ${lvl}`,system:true,time:Date.now()});
                return;
            case "?/unban":
                remove(ref(db,`users/${parts[1]}/banned/${user.username}`));
                return;
            case "?/unmute":
                remove(ref(db,`users/${parts[1]}/muted/${user.username}`));
                return;
            case "?/rank":
                if(!["pioneer"].includes(rank)) return alert("No permission");
                update(ref(db,`users/${parts[1]}`),{rank:parts[2]});
                return;
        }
    }

    push(ref(db,`messages/${room}`),{sender:user.username,text,title:user.activeTitle||"",time:Date.now()});
};

window.leaveRoom=async function(){
    const u=window.currentUser.username;
    push(ref(db,`messages/${room}`),{sender:u,text:`[SYSTEM] ${u} has left the chat.`,system:true,time:Date.now()});
    window.location.href="dashboard.html";
};
