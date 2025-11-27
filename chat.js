// chat.js — chat UI, reactions, delete, commands, banned/muted enforcement, presence removal
import { db } from "./app.js";
import {
  ref, push, onValue, remove, set, get, update
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const room = params.get("room");
if (!room) {
  document.body.innerHTML = "<p>No room specified. <a href='dashboard.html'>Back to dashboard</a></p>";
  throw new Error("No room specified");
}

const roomTitleEl = document.getElementById("room-title");
roomTitleEl.textContent = "Room: " + room;

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("msg-input");

const EMOJI_LIST = ["👍","❤️","😂","😮","😢","😡"];

// Enter presence & announce join
(async function enterPresenceAndAnnounce() {
  if (!window.currentUser) {
    window.location.href = "index.html";
    return;
  }

  const u = window.currentUser.username;

  const userBanned = (await get(ref(db, `users/${u}/banned`))).exists();
  const roomBanned = (await get(ref(db, `rooms/${room}/banned/${u}`))).exists();
  if (userBanned || roomBanned) {
    alert("You are banned and cannot enter this room.");
    await remove(ref(db, `rooms/${room}/members/${u}`)).catch(()=>{});
    window.location.href = "dashboard.html";
    return;
  }

  await set(ref(db, `rooms/${room}/members/${u}`), Date.now());

  await push(ref(db, `messages/${room}`), {
    sender: "SYSTEM",
    text: `${u} has joined the chat.`,
    time: Date.now(),
    system: true
  });

  window.addEventListener("beforeunload", async () => {
    try { await remove(ref(db, `rooms/${room}/members/${u}`)); } catch {}
  });
})().catch(console.error);

// Render message row
async function renderMessage(msgId, m) {
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper";
  wrapper.dataset.msgid = msgId;

  if (m.system) {
    const sys = document.createElement("div");
    sys.className = "system-msg";
    sys.textContent = m.text || "(system)";
    wrapper.appendChild(sys);
    return wrapper;
  }

  const header = document.createElement("div");
  header.className = "msg-header";
  header.textContent = (m.title ? `[${m.title}] ` : "") + (m.sender || "?");
  wrapper.appendChild(header);

  const body = document.createElement("div");
  body.className = "msg-body";
  body.textContent = m.text || "";
  wrapper.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "msg-actions";

  // Reactions bar
  const reactionBar = document.createElement("div");
  reactionBar.className = "reaction-bar";

  const reactsSnap = await get(ref(db, `reactions/${room}/${msgId}`));
  const counts = {};
  const userReacts = {};
  if (reactsSnap.exists()) {
    reactsSnap.forEach(rSnap => {
      const uname = rSnap.key;
      const r = rSnap.val();
      if (!r || !r.type) return;
      counts[r.type] = (counts[r.type] || 0) + 1;
      userReacts[uname] = r.type;
    });
  }
  const currentUserReaction = userReacts[window.currentUser.username];

  EMOJI_LIST.forEach(emoji => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-btn";
    btn.textContent = `${emoji} ${counts[emoji] || ""}`.trim();
    if (currentUserReaction === emoji) btn.classList.add("emoji-active");
    btn.onclick = async () => {
      const rp = { newbie:0, member:1, admin:2, high:3, core:4, pioneer:5 }[window.currentUser.rank] || 0;
      if (rp < 1) return alert("You must be a member to react.");
      const myPath = ref(db, `reactions/${room}/${msgId}/${window.currentUser.username}`);
      const cur = await get(myPath);
      if (cur.exists() && cur.val().type === emoji) {
        await remove(myPath);
      } else {
        await set(myPath, { type: emoji, time: Date.now() });
      }
    };
    reactionBar.appendChild(btn);
  });

  actions.appendChild(reactionBar);

  // Delete button for owner
  if (window.currentUser.username === m.sender) {
    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.onclick = async () => {
      if (!confirm("Delete this message?")) return;
      await remove(ref(db, `messages/${room}/${msgId}`));
      await remove(ref(db, `reactions/${room}/${msgId}`));
    };
    actions.appendChild(del);
  }

  wrapper.appendChild(actions);
  return wrapper;
}

// Listen for messages
onValue(ref(db, `messages/${room}`), async (snap) => {
  messagesEl.innerHTML = "";
  const arr = [];
  snap.forEach(s => arr.push({ id: s.key, val: s.val() }));
  arr.sort((a,b) => (a.val.time || 0) - (b.val.time || 0));
  for (const item of arr) {
    const el = await renderMessage(item.id, item.val);
    messagesEl.appendChild(el);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}, (err) => console.warn("messages onValue error", err));

// Commands & send
function normalizeCommandText(text) {
  if (text.startsWith("?/")) return "/" + text.slice(2);
  return text;
}
function parseMsg(rest) {
  const match = rest.match(/^(\S+)\s+["']([\s\S]+)["']$/);
  if (!match) return null;
  return { target: match[1], text: match[2] };
}

window.sendMessage = async function() {
  if (!window.currentUser) return alert("Not logged in.");
  const user = window.currentUser;

  // Check mutes (global or room)
  const gMuteSnap = await get(ref(db, `users/${user.username}/muted`));
  if (gMuteSnap.exists()) return alert("You are muted and cannot send messages.");
  const rMuteSnap = await get(ref(db, `rooms/${room}/muted/${user.username}`));
  if (rMuteSnap.exists()) return alert("You are muted in this room and cannot send messages.");

  let text = (inputEl.value || "").trim();
  if (!text) return;
  inputEl.value = "";

  text = normalizeCommandText(text);

  if (text.startsWith("/")) {
    const m = text.match(/^\/(\w+)\s*(.*)$/s);
    if (!m) {
      await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: "Invalid command format.", time: Date.now(), system: true });
      return;
    }
    const cmd = m[1].toLowerCase();
    const rest = (m[2] || "").trim();

    switch (cmd) {
      case "me":
        if (!rest) return alert("Usage: /me text");
        await push(ref(db, `messages/${room}`), { sender: user.username, text: `* ${rest}`, time: Date.now(), title: user.activeTitle || "", system: false });
        return;

      case "title":
        if (!rest) return alert("Usage: /title NewTitle");
        await set(ref(db, `users/${user.username}/titles/${rest}`), true);
        await update(ref(db, `users/${user.username}`), { activeTitle: rest });
        window.currentUser.activeTitle = rest;
        saveUser(window.currentUser);
        alert(`Title set to "${rest}"`);
        return;

      case "leave":
        await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `${user.username} has left the chat.`, time: Date.now(), system: true });
        await remove(ref(db, `rooms/${room}/members/${user.username}`));
        await push(ref(db, "logs"), { type: "leave", user: user.username, room, time: Date.now() });
        window.location.href = "dashboard.html";
        return;

      case "help":
        await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: "Commands: /me /title /leave /help /msg recipient \"text\" /ban /unban /mute /unmute /kick /rank", time: Date.now(), system: true });
        return;

      case "msg": {
        const power = rolePower(user.rank);
        if (power < rolePower("member")) return alert("Private messages require member rank.");
        const parsed = parseMsg(rest);
        if (!parsed) return alert('Usage: /msg recipient "text"');
        const pm = { from: user.username, text: parsed.text, time: Date.now(), visibleToStaff: true };
        await push(ref(db, `private/${parsed.target}`), pm);
        await push(ref(db, `private/${user.username}`), { ...pm, to: parsed.target });
        await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `${user.username} sent a private message to ${parsed.target}. (staff may view)`, time: Date.now(), system: true });
        return;
      }

      case "ban":
      case "mute":
      case "unban":
      case "unmute":
      case "kick":
      case "rank": {
        const tokens = rest.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return alert(`Usage: /${cmd} username [level/global]`);
        const target = tokens[0];
        let level = 1;
        if (tokens[1] && /^\d+$/.test(tokens[1])) level = parseInt(tokens[1], 10);
        const isGlobal = tokens.includes("global");
        const actorPower = rolePower(user.rank);
        const requiredForLevel = lvl => (lvl === 1 ? 2 : lvl === 2 ? 3 : lvl === 3 ? 4 : 5);

        try {
          const targetSnap = await get(ref(db, `users/${target}`));
          if (!targetSnap.exists()) return alert("Target user not found.");
          const targetData = targetSnap.val();

          if (cmd === "kick") {
            if (actorPower < rolePower("admin")) return alert("Kick requires admin+.");
            if (rolePower(targetData.rank) >= actorPower) return alert("Cannot act on equal/higher rank.");
            await remove(ref(db, `rooms/${room}/members/${target}`));
            await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `${target} was kicked by ${user.username}.`, time: Date.now(), system: true });
            return;
          }

          if (cmd === "rank") {
            if (actorPower < rolePower("pioneer")) return alert("Only pioneer can change ranks.");
            const newRank = tokens[1];
            if (!newRank || !(newRank in ROLE_POWER)) return alert("Invalid rank specified.");
            await update(ref(db, `users/${target}`), { rank: newRank });
            await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `${target} rank changed to ${newRank} by ${user.username}.`, time: Date.now(), system: true });
            return;
          }

          const minPower = requiredForLevel(level);
          if (actorPower < minPower) return alert(`You need higher power to perform this action at level ${level}.`);
          if (rolePower(targetData.rank) >= actorPower) return alert("Cannot act on equal/higher rank.");

          const scopePath = isGlobal ? `${cmd}s/global/${target}` : `${cmd}s/room:${room}/${target}`;
          if (cmd === "ban" || cmd === "mute") {
            await set(ref(db, scopePath), { by: user.username, level, time: Date.now() });
            if (cmd === "ban") await set(ref(db, `users/${target}/banned`), { by: user.username, level, time: Date.now() }).catch(()=>{});
            else await set(ref(db, `users/${target}/muted`), { by: user.username, level, time: Date.now() }).catch(()=>{});
            await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `${target} ${cmd}ned at level ${level} by ${user.username}.`, time: Date.now(), system: true });
            return;
          } else if (cmd === "unban" || cmd === "unmute") {
            await remove(ref(db, scopePath));
            if (cmd === "unban") await remove(ref(db, `users/${target}/banned`)).catch(()=>{});
            else await remove(ref(db, `users/${target}/muted`)).catch(()=>{});
            await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `${target} ${cmd}ned by ${user.username}.`, time: Date.now(), system: true });
            return;
          }
        } catch (e) {
          console.error("moderation command error", e);
          alert("Command failed.");
          return;
        }
      }

      default:
        await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `Unknown command: /${cmd}`, time: Date.now(), system: true });
        return;
    }
  }

  // Normal message
  await push(ref(db, `messages/${room}`), {
    sender: user.username,
    text,
    time: Date.now(),
    title: user.activeTitle || "",
    system: false
  });
};

// Leave wrapper
window.leaveRoomCmd = async function() {
  if (!window.currentUser) return;
  await push(ref(db, `messages/${room}`), { sender: "SYSTEM", text: `${window.currentUser.username} has left the chat.`, time: Date.now(), system: true });
  await remove(ref(db, `rooms/${room}/members/${window.currentUser.username}`));
  window.location.href = "dashboard.html";
};
