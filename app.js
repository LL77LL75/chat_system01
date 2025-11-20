import { db } from './firebase-config.js';
import { ref, get, set, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Normal Login
// ------------------------
window.normalLogin = async function () {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const userRef = ref(db, `users/${username}`);
    const snap = await get(userRef);
    if(!snap.exists() || snap.val().password !== password){ alert('Invalid credentials'); return; }
    window.currentUser = { username, ...snap.val() };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    window.location.href="dashboard.html";
};

// ------------------------
// Credits System (1 min check)
// ------------------------
async function creditCheck(){
    const userRef = ref(db, `users/${window.currentUser.username}`);
    const snap = await get(userRef);
    if(!snap.exists()) return;
    let user = snap.val();
    let incr = 0;
    const rank = user.rank;
    if(rank==='newbie') incr=1;
    else if(rank==='member') incr=5;
    else if(rank==='admin') incr=15;
    else if(rank==='high') incr=20;
    else if(rank==='core') incr=45;
    user.credits = (user.credits||0)+incr;
    await update(userRef,{credits:user.credits});
    // Check rank up
    if(user.rank==='newbie' && user.credits>=30){ user.rank='member'; await update(userRef,{rank:'member'}); }
}
setInterval(creditCheck,60000);

// ------------------------
// Rooms
// ------------------------
export async function loadRooms(){
    const roomsRef = ref(db,'rooms');
    const snap = await get(roomsRef);
    return snap.exists()?snap.val():{};
}

// ------------------------
// Account changes (from popup)
// ------------------------
export async function saveAccountChanges(displayName,password,equippedTitle){
    const userRef = ref(db,`users/${window.currentUser.username}`);
    window.currentUser.displayName = displayName;
    window.currentUser.password = password;
    window.currentUser.equippedTitle = equippedTitle;
    await update(userRef,{displayName,password,equippedTitle});
}

// ------------------------
// Auctions
// ------------------------
export async function startAuction(title,startingBid,duration){
    const room = new URLSearchParams(window.location.search).get('room')||'global';
    const auctionsRef = ref(db,`auctions/${room}`);
    const keyRef = push(auctionsRef);
    await set(keyRef,{
        title,startingBid,owner:window.currentUser.username,end:Date.now()+duration
    });
    alert(`Auction started: ${title}`);
}

// ------------------------
// Shop (titles)
// ------------------------
export async function openShop(){ alert('Shop placeholder (buy titles)'); }
