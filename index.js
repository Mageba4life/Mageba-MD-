const http = require("http");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const PORT = process.env.PORT || 3000;

// Your WhatsApp bot number
const BOT_NUMBER = (process.env.BOT_NUMBER || "")
  .replace(/\D/g, "");

// Your owner number
const OWNER_NUMBER = (process.env.OWNER_NUMBER || "")
  .replace(/\D/g, "");

// --------------------------------------------------
// Render web server
// --------------------------------------------------

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Mageba-MD is running!");
}).listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

console.log("🚀 Mageba-MD starting...");
console.log("🤖 Bot number:", BOT_NUMBER || "NOT SET");
console.log("👑 Owner number:", OWNER_NUMBER || "NOT SET");

// --------------------------------------------------
// Bot
// --------------------------------------------------

let reconnecting = false;

async function startBot() {
  if (reconnecting) return;

  try {
    console.log("");
    console.log("=================================");
    console.log("🚀 STARTING WHATSAPP");
    console.log("=================================");

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState("session");

    console.log(
      "🔐 Session registered:",
      state.creds.registered
    );

    const sock = makeWASocket({
      auth: state,
      logger: pino({
        level: "silent"
      }),
      printQRInTerminal: false,
      markOnlineOnConnect: true
    });

    // Save WhatsApp credentials
    sock.ev.on(
      "creds.update",
      saveCreds
    );

    // --------------------------------------------------
    // Pairing code
    // --------------------------------------------------

    if (!state.creds.registered) {

      if (!BOT_NUMBER) {
        console.log("");
        console.log("❌ BOT_NUMBER is missing.");
        console.log(
          "Add BOT_NUMBER in Render Environment Variables."
        );
        return;
      }

      console.log("");
      console.log(
        "📱 Preparing WhatsApp pairing..."
      );

      try {

        // Give the socket time to initialize
        await new Promise(resolve =>
          setTimeout(resolve, 5000)
        );

        console.log(
          "📱 Requesting pairing code..."
        );

        const code =
          await sock.requestPairingCode(
            BOT_NUMBER
          );

        console.log("");
        console.log(
          "================================="
        );
        console.log(
          "📱 WHATSAPP PAIRING CODE"
        );
        console.log(
          "🔑 CODE:",
          code
        );
        console.log(
          "================================="
        );
        console.log("");
        console.log(
          "👉 On WhatsApp:"
        );
        console.log(
          "Linked devices → Link a device → Link with phone number instead"
        );
        console.log(
          "Then enter the code above."
        );
        console.log("");

      } catch (error) {

        console.log("");
        console.log(
          "❌ PAIRING CODE ERROR"
        );
        console.log(
          error.message
        );
        console.log("");

      }
    }

    // --------------------------------------------------
    // Connection updates
    // --------------------------------------------------

    sock.ev.on(
      "connection.update",
      (update) => {

        const {
          connection,
          lastDisconnect
        } = update;

        console.log(
          "🔌 Connection:",
          connection
        );

        if (connection === "open") {

          reconnecting = false;

          console.log("");
          console.log(
            "================================="
          );
          console.log(
            "✅ MAGEBA-MD CONNECTED!"
          );
          console.log(
            "🤖 Bot:",
            BOT_NUMBER
          );
          console.log(
            "👑 Owner:",
            OWNER_NUMBER
          );
          console.log(
            "================================="
