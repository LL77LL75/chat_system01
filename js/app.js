// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue, push, child } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { firebaseConfig } from './firebase.config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// Helper function to get a reference
export const dbRef = (path = '/') => ref(db, path);

// Function to login user
export async function loginUser(username, password) {
  try {
    const userSnap = await get(dbRef(`users/${username}`));
    if (!userSnap.exists()) return { success: false, error: 'User not found' };
    const userData = userSnap.val();
    if (userData.password !== password) return { success: false, error: 'Incorrect password' };
    return { success: true, data: userData };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Database error' };
  }
}

// Function to create a new room
export async function createOrJoinRoom(roomCode, username) {
  const roomReference = dbRef(`rooms/${roomCode}`);
  const roomSnap = await get(roomReference);
  if (!roomSnap.exists()) {
    await set(roomReference, { createdBy: username, messages: [], bans: [], mutes: [] });
  }
  return roomReference;
}

// Function to send a chat message
export function sendMessage(roomCode, sender, content) {
  const messagesRef = dbRef(`rooms/${roomCode}/messages`);
  const msgRef = push(messagesRef);
  set(msgRef, {
    sender,
    content,
    timestamp: Date.now()
  });
}

// Function to listen for new messages in a room
export function onNewMessage(roomCode, callback) {
  const messagesRef = dbRef(`rooms/${roomCode}/messages`);
  onValue(messagesRef, snapshot => {
    const messages = snapshot.val() || {};
    callback(messages);
  });
}

// Function to change username
export async function changeUsername(oldName, newName) {
  const userSnap = await get(dbRef(`users/${oldName}`));
  if (!userSnap.exists()) return false;
  const userData = userSnap.val();
  await set(dbRef(`users/${newName}`), userData);
  await set(dbRef(`users/${oldName}`), null);
  return true;
}

// Function to change user title
export async function addTitle(username, title) {
  const titlesRef = dbRef(`users/${username}/titles`);
  const titleRef = push(titlesRef);
  await set(titleRef, title);
}
