// For chat.html functionality; all main logic is already in app.js
window.addEventListener("load", () => {
    if (window.location.pathname.includes("chat.html")) {
        window.loadMessages();
    }
});
