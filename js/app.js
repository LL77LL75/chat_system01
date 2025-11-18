// app.js — main logic for login, account creation, commands, chat, dashboard

import { app } from "./firebase-config.js";
import {
    getDatabase, ref, set, get, update, push, onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const db = getDatabase(app);

// Rank power hierarchy (higher number = stronger)
const RANK_POWER = {
    "newbie": 1,
    "member": 2,
    "admin": 3,
    "high": 4,
    "core": 5,
    "pioneer": 6
};

// Default titles per rank
const RANK_TITLES = {
    "newbie": ["newbie", "newcomer"],
    "member": ["member", "long-time newbie"],
    "admin": ["official", "trusty person"],
    "high": ["powerful", "trusted person"],
    "core": ["godly power"],
    "pioneer": ["pioneer", "founder"]
};

let currentUser = null;
let currentUsername = null;

// PLATFORM CHECK
function isMobile() {
    return /android|iphone|ipad|iPod/i.test(navigator.userAgent);
}

// LOGIN SYSTEM
export async function login(username, password) {
    const snap = await get(ref(db, `users/${username}`));

    if (!snap.exists()) return { success: false, msg: "User does not exist." };

    const data = snap.val();

    if (!isMobile() && (data.rank === "core" || data.rank === "pioneer")) {
        // PC console login required
        console.warn(`PC detected. Enter this in console:\nloginConsole("${username}", "${password}")`);
        return { success: false, msg: "Pioneer/Core must login via console on PC." };
    }

    // Normal login
    if (data.password !== password) {
        return { success: false, msg: "Incorrect password." };
    }

    if (data.status === "pending") {
        return { success: false, msg: "Account awaiting approval." };
    }

    currentUser = data;
    currentUsername = username;

    return { success: true, msg: "Login successful." };
}

// CONSOLE LOGIN (PC ONLY)
window.loginConsole = async function (username, password) {
    if (isMobile()) {
        console.warn("Mobile cannot use console login.");
        return;
    }

    const snap = await get(ref(db, `users/${username}`));
    if (!snap.exists()) return console.warn("User does not exist.");
    const data = snap.val();

    if (data.password !== password) return console.warn("Incorrect password.");
    if (data.status === "pending") return console.warn("Account awaiting approval.");

    currentUser = data;
    currentUsername = username;

    console.warn(`Console login successful as ${username} (${data.rank})`);
};

// REGISTER ACCOUNT (requires approval)
export async function registerAccount(username, password) {
    const check = await get(ref(db, `users/${username}`));
    if (check.exists()) return { success: false, msg: "Username already exists." };

    await set(ref(db, `users/${username}`), {
        username,
        password,
        rank: "newbie",
        status: "pending",
        credits: 0,
        titles: [...RANK_TITLES["newbie"]],
        muted: false,
        banned: false
    });

    return { success: true, msg: "Account created. Awaiting approval from core/pioneer." };
}

// APPROVE ACCOUNT
async function approveUser(target) {
    const snap = await get(ref(db, `users/${target}`));
    if (!snap.exists()) return "User not found.";

    await update(ref(db, `users/${target}`), { status: "active" });
    return `${target} has been approved.`;
}

// CHECK RANK PERMISSION
function hasPowerOver(actor, target) {
    return RANK_POWER[actor.rank] > RANK_POWER[target.rank];
}

// COMMAND HANDLER
async function processCommand(text) {
    if (!currentUser) return "Not logged in.";

    if (!text.startsWith("?/")) return "Invalid command format.";

    const parts = text.substring(2).split(" ");
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {

        case "approve": {
            if (currentUser.rank !== "core" && currentUser.rank !== "pioneer")
                return "Only core/pioneer can approve accounts.";
            return await approveUser(args[0]);
        }

        // Give credits
        case "give": {
            const target = args[0];
            const amount = parseInt(args[1]);

            const snap = await get(ref(db, `users/${target}`));
            if (!snap.exists()) return "Target user not found.";

            const data = snap.val();

            if (!hasPowerOver(currentUser, data))
                return "You do not have enough rank power.";

            await update(ref(db, `users/${target}`), {
                credits: data.credits + amount
            });

            return `Gave ${amount} credits to ${target}`;
        }

        // Auction (anyone can auction titles)
        case "auction": {
            const item = args[0];
            const price = parseInt(args[1]);

            const pushRef = push(ref(db, "auctions"));
            await set(pushRef, {
                seller: currentUsername,
                item,
                startingPrice: price
            });

            return `Auction created: ${item} starting at ${price} credits.`;
        }

        // Pioneer: create custom title
        case "makeTitle": {
            if (currentUser.rank !== "pioneer")
                return "Only a pioneer can create titles.";

            const target = args[0];
            const customTitle = args.slice(1).join(" ");

            const snap = await get(ref(db, `users/${target}`));
            if (!snap.exists()) return "Target not found.";

            const oldTitles = snap.val().titles || [];

            await update(ref(db, `users/${target}`), {
                titles: [...oldTitles, customTitle]
            });

            return `Custom title '${customTitle}' added to ${target}.`;
        }

        // Mute / Unmute
        case "mute":
        case "unmute": {
            const target = args[0];
            const snap = await get(ref(db, `users/${target}`));
            if (!snap.exists()) return "User not found.";

            const data = snap.val();

            if (!hasPowerOver(currentUser, data))
                return "Cannot mute/unmute higher or equal rank.";

            await update(ref(db, `users/${target}`), {
                muted: cmd === "mute"
            });

            return `${target} ${cmd === "mute" ? "muted" : "unmuted"}.`;
        }

        // Ban / Unban
        case "ban":
        case "unban": {
            const target = args[0];
            const snap = await get(ref(db, `users/${target}`));
            if (!snap.exists()) return "User not found.";

            const data = snap.val();

            if (!hasPowerOver(currentUser, data))
                return "Cannot ban/unban higher or equal rank.";

            await update(ref(db, `users/${target}`), {
                banned: cmd === "ban"
            });

            return `${target} ${cmd === "ban" ? "banned" : "unbanned"}.`;
        }

        default:
            return "Unknown command.";
    }
}

// PUBLIC FUNCTION FOR CHAT/ DASHBOARD
export async function handleConsoleInput(text) {
    return await processCommand(text);
}
