// app.js — clean version with advanced commands, bans and mutes
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

function now(){return Date.now();}
function loadUser(){let u=localStorage.getItem("currentUser");try{return JSON.parse(u);}catch{return null;}}
function saveUser(user){localStorage.setItem("currentUser",JSON.stringify(user));}
window.currentUser=loadUser();

// Cleanup old messages/logs (>15 days)
async function cleanupOldData(){
    const cutoff=now()-15*24*60*60*1000;
    const msgsSnap=await get(ref(db,"messages"));
    msgsSnap.forEach(roomSnap=>{roomSnap.forEach(msgSnap=>{if(msgSnap.val().time<cutoff) remove(ref(db,`messages/${roomSnap.key}/${msgSnap.key}`));});});
    const logsSnap=await get(ref(db,"logs"));
    logsSnap.forEach(logSnap=>{if(logSnap.val().time<cutoff) remove(ref(db,`logs/${logSnap.key}`));});
}
cleanupOldData();

// --- LOGIN ---
window.normalLogin=async function(username,password){
    const snap=await get(ref(db,`users/${username}`));
    if(!snap.exists()) return alert("User not found.");
    const data=snap.val();
    if(data.password!==password) return alert("Wrong password.");
    window.currentUser={username,...data};
    saveUser(window.currentUser);
    push(ref(db,"logs"),{type:"login",user:username,time:now()});
    window.location.href="dashboard.html";
};

// --- LOGOUT ---
window.logout=function(){
    if(window.currentUser) push(ref(db,"logs"),{type:"logout",user:window.currentUser.username,time:now()});
    localStorage.removeItem("currentUser");
    window.location.href="index.html";
};

// --- DASHBOARD ROOMS ---
window.loadRooms=function(){
    const list=document.getElementById("room-list");
    const panel=document.getElementById("room-info-panel");
    if(!list||!panel) return;
    onValue(ref(db,"rooms"),snap=>{
        list.innerHTML="";
        snap.forEach(roomNode=>{
            const room=roomNode.key;
            const btn=document.createElement("button");
            btn.className="room-btn";
            btn.textContent=room;
            btn.onclick=()=>window.loadRoomInfo(room);
            list.appendChild(btn);
        });
    });
};

window.loadRoomInfo=function(room){
    const panel=document.getElementById("room-info-panel");
    if(!panel) return;
    onValue(ref(db,`rooms/${room}/members`),snap=>{
        let members=[];
        snap.forEach(userSnap=>members.push(userSnap.key));
        panel.innerHTML=`
            <h3>Room: ${room}</h3>
            <p>Users inside:</p>
            <ul>${members.map(u=>`<li>${u}</li>`).join("")}</ul>
            <button onclick="joinRoom('${room}')">Join Room</button>
        `;
    });

    const rank=window.currentUser?.rank;
    if(["admin","high","core","pioneer"].includes(rank)){
        onValue(ref(db,`rooms/${room}/banned`),bSnap=>{panel.innerHTML+=`<p>Banned: ${bSnap.exists()?Object.keys(bSnap.val()).join(", "):"None"}</p>`;});
        onValue(ref(db,`rooms/${room}/muted`),mSnap=>{panel.innerHTML+=`<p>Muted: ${mSnap.exists()?Object.keys(mSnap.val()).join(", "):"None"}</p>`;});
    }
};

// --- JOIN ROOM ---
window.joinRoom=async function(room){
    if(!window.currentUser) return alert("Not logged in.");
    const u=window.currentUser.username;
    const bannedSnap=await get(ref(db,`users/${u}/banned`));
    if(bannedSnap.exists()) return alert("You are banned and cannot join rooms.");
    await set(ref(db,`rooms/${room}/members/${u}`),now());
    push(ref(db,`messages/${room}`),{sender:u,text:`[SYSTEM] ${u} has joined the chat.`,system:true,time:now()});
    push(ref(db,"logs"),{type:"join",user:u,room,time:now()});
    window.location.href=`chat.html?room=${room}`;
};

// --- ACCOUNT POPUP ---
window.openAccountPopup=function(){
    const popup=document.getElementById("account-popup");
    if(!popup) return;
    document.getElementById("displayname-input").value=window.currentUser?.displayName||"";
    popup.style.display="block";
};
window.closeAccountPopup=function(){document.getElementById("account-popup").style.display="none";};

// --- CHANGE DISPLAYNAME ---
window.changeDisplayName=async function(){
    const newName=document.getElementById("displayname-input").value.trim();
    if(!newName) return alert("Display name cannot be empty.");
    const u=window.currentUser.username;
    await update(ref(db,`users/${u}`),{displayName:newName});
    window.currentUser.displayName=newName;
    saveUser(window.currentUser);
    alert("Display name updated.");
};

// --- CHANGE PASSWORD ---
window.changePassword=async function(){
    const pw=prompt("Enter new password:");
    if(!pw) return;
    const u=window.currentUser.username;
    await update(ref(db,`users/${u}`),{password:pw});
    window.currentUser.password=pw;
    saveUser(window.currentUser);
    alert("Password updated.");
};

// --- SET ACTIVE TITLE ---
window.setActiveTitle=async function(){
    const title=document.getElementById("title-select").value;
    const u=window.currentUser.username;
    await update(ref(db,`users/${u}`),{activeTitle:title});
    window.currentUser.activeTitle=title;
    saveUser(window.currentUser);
    alert("Title updated.");
};

// --- CREATE NEW ACCOUNT (CORE+PIONEER) ---
window.createNewAccount=async function(){
    if(!window.currentUser) return alert("Not logged in.");
    const rank=window.currentUser.rank;
    if(!["core","pioneer"].includes(rank)) return alert("No permission.");
    const username=prompt("New username:");
    if(!username) return;
    const password=prompt("New password:");
    if(!password) return;
    const userRank=prompt("Rank (newbie/member/admin/high/core/pioneer):","newbie");
    await set(ref(db,`users/${username}`),{
        password,
        displayName:username,
        rank:userRank,
        activeTitle:"newbie",
        titles:{newbie:true},
        createdAt:now()
    });
    alert("Account created!");
};

export {db};
