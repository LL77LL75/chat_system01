// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, remove } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const dbRef = (path) => ref(db, path);

export const ranks = {
  newbie: {
    titles: ["newbie", "newcomer"],
    abilities: ["join","chat","bid","auction"],
    creditInterval: 15*60*1000
  },
  member: {
    titles: ["member","long-time newbie"],
    abilities: ["join","chat","bid","auction","react","msg"],
    creditInterval: 20*60*1000
  },
  admin: {
    titles: ["official","trusty person"],
    abilities: ["join","chat","bid","auction","react","msg","startRoom","closeRoom","kick"],
    creditInterval: 25*60*1000
  },
  high: {
    titles: ["powerful","trusted person"],
    abilities: ["join","chat","bid","auction","react","msg","startRoom","closeRoom","ban","mute","unban","unmute","kick"],
    creditInterval: 30*60*1000
  },
  core: {
    titles: ["godly power"],
    abilities: ["join","chat","bid","auction","react","msg","startRoom","closeRoom","ban","mute","unban","unmute","kick","give"],
    creditInterval: 0
  },
  pioneer: {
    titles: ["pioneer","founder"],
    abilities: ["join","chat","bid","auction","react","msg","startRoom","closeRoom","ban","mute","unban","unmute","kick","give","promote","createTitle","sellTitle"],
    creditInterval: 0
  }
};

// Login user
export async function loginUser(username, password) {
  const snap = await get(dbRef(`users/${username}`));
  if (!snap.exists()) return { success:false, error:"User not found" };
  const data = snap.val();
  if (data.password !== password) return { success:false, error:"Wrong password" };
  if (data.status !== "active") return { success:false, error:"Account not active" };
  return { success:true, data };
}

// Create or join room
export async function createOrJoinRoom(roomCode, username) {
  const roomRef = dbRef(`rooms/${roomCode}`);
  const snap = await get(roomRef);
  if (!snap.exists()) {
    await set(roomRef, { createdBy:username, messages:{}, participants:{} });
  }
  await update(dbRef(`rooms/${roomCode}/participants/${username}`), { joinedAt: Date.now() });
  return roomRef;
}

// Send message
export function sendMessage(roomCode, sender, content) {
  const msgRef = push(dbRef(`rooms/${roomCode}/messages`));
  set(msgRef, {
    sender, content, timestamp: Date.now(), edited:false
  });
}

// Listen for messages
export function onNewMessage(roomCode, callback) {
  onValue(dbRef(`rooms/${roomCode}/messages`), snap => {
    const msgs = snap.val() || {};
    callback(msgs);
  });
}

// Change title (user)
export async function changeTitle(username, newTitle) {
  await update(dbRef(`users/${username}`), { titles:[newTitle] });
}

// Give item (credits or title)
export async function giveItem(sender, target, item, value) {
  const snap = await get(dbRef(`users/${sender}`));
  if (!snap.exists()) return false;
  const sData = snap.val();
  if (!ranks[sData.rank].abilities.includes("give")) return false;

  if (item === "credits") {
    const tSnap = await get(dbRef(`users/${target}`));
    if (!tSnap.exists()) return false;
    const tData = tSnap.val();
    const newCredits = (tData.credits||0) + Number(value);
    await update(dbRef(`users/${target}`), { credits:newCredits });
    return true;
  }
  if (item === "title") {
    const tSnap = await get(dbRef(`users/${target}`));
    if (!tSnap.exists()) return false;
    const tTitles = tSnap.val().titles || [];
    tTitles.push(value);
    await update(dbRef(`users/${target}`), { titles:tTitles });
    return true;
  }
  return false;
}

// Create a new title (pioneer only)
export async function createTitle(creator, titleName, cost) {
  const snap = await get(dbRef(`users/${creator}`));
  if (!snap.exists()) return false;
  const data = snap.val();
  if (!ranks[data.rank].abilities.includes("createTitle")) return false;

  const tRef = push(dbRef(`titles`));
  await set(tRef, { name: titleName, cost:Number(cost), createdBy:creator });
  return true;
}

// Sell a title (pioneer only)
export async function sellTitle(seller, titleId, buyer) {
  const sSnap = await get(dbRef(`users/${seller}`));
  if (!sSnap.exists()) return false;
  const sData = sSnap.val();
  if (!ranks[sData.rank].abilities.includes("sellTitle")) return false;

  const tSnap = await get(dbRef(`titles/${titleId}`));
  if (!tSnap.exists()) return false;
  const tData = tSnap.val();

  const bSnap = await get(dbRef(`users/${buyer}`));
  if (!bSnap.exists()) return false;
  const bData = bSnap.val();

  if ((bData.credits||0) < tData.cost) return false;

  await update(dbRef(`users/${buyer}`), { credits:(bData.credits - tData.cost) });
  const bt = bData.titles || [];
  bt.push(tData.name);
  await update(dbRef(`users/${buyer}`), { titles:bt });
  return true;
}

// Promote user (pioneer only)
export async function promoteUser(promoter, target, newRank) {
  const pSnap = await get(dbRef(`users/${promoter}`));
  if (!pSnap.exists()) return false;
  const pData = pSnap.val();
  if (pData.rank !== "pioneer") return false;
  if (!ranks[newRank]) return false;

  await update(dbRef(`users/${target}`), { rank:newRank });
  return true;
}
