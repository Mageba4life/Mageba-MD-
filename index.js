const http = require("http");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

// ===============================
// RENDER WEB SERVER
// ===============================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("Mageba-MD is running!");
}).listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ===============================
// NUMBERS
// ===============================

// BOT_NUMBER = WhatsApp number that will run the bot
// OWNER_NUMBER = WhatsApp number allowed to control the bot

const BOT_NUMBER = (process.env.BOT_NUMBER || "")
  .replace(/\D/g, "");

const OWNER_NUMBER = (process.env.OWNER_NUMBER || "")
  .replace(/\D/g, "");

// ===============================
// BOT STATE
// ===============================

let sock = null;
let reconnecting = false;

// ===============================
// START BOT
// ===============================

async function startBot() {

  if (reconnecting) {
    return;
  }

  reconnecting = true;

  try {

    console.log("");
    console.log("🚀 Starting Mageba-MD...");

    // Load WhatsApp session
    const { state, saveCreds } =
      await useMultiFileAuthState("session");

    sock = makeWASocket({
      auth: state,
      logger: pino({
        level: "silent"
      }),
      printQRInTerminal: false
    });

    // Save authentication credentials
    sock.ev.on(
      "creds.update",
      saveCreds
    );

    // ===============================
    // PAIRING CODE
    // ===============================

    if (!state.creds.registered) {

      if (!BOT_NUMBER) {

        console.log(
          "❌ BOT_NUMBER is missing."
        );

      } else {

        try {

          console.log(
            "📱 Preparing WhatsApp pairing..."
          );

          // Give the socket time to initialize
          await new Promise(resolve =>
            setTimeout(resolve, 5000)
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

        } catch (error) {

          console.log(
            "❌ Pairing code error:"
          );

          console.log(
            error.message
          );
        }

      }

    } else {

      console.log(
        "✅ Existing WhatsApp session found."
      );
    }

    // ===============================
    // CONNECTION
    // ===============================

    sock.ev.on(
      "connection.update",
      async (update) => {

        const {
          connection,
          lastDisconnect
        } = update;

        // Connected
        if (connection === "open") {

          reconnecting = false;

          console.log("");
          console.log(
            "================================="
          );
          console.log(
            "✅ Mageba-MD CONNECTED!"
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
          );
          console.log("");

        }

        // Disconnected
        if (connection === "close") {

          console.log(
            "❌ WhatsApp connection closed."
          );

          const statusCode =
            lastDisconnect?.error
              ?.output
              ?.statusCode;

          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {

            console.log(
              "⚠️ WhatsApp logged out."
            );

            console.log(
              "⚠️ A new pairing is required."
            );

            reconnecting = false;

            return;
          }

          reconnecting = false;

          console.log(
            "🔄 Reconnecting in 10 seconds..."
          );

          setTimeout(() => {
            startBot();
          }, 10000);
        }
      }
    );

    // ===============================
    // MESSAGES
    // ===============================

    sock.ev.on(
      "messages.upsert",
      async ({ messages }) => {

        try {

          const msg = messages?.[0];

          if (!msg) {
            return;
          }

          // Ignore messages sent by the bot itself
          if (msg.key.fromMe) {
            return;
          }

          if (!msg.message) {
            return;
          }

          const jid =
            msg.key.remoteJid || "";

          // Get sender
          const sender = (
            msg.key.participant ||
            jid ||
            ""
          )
            .split("@")[0]
            .replace(/\D/g, "");

          // Get text
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage
              ?.text ||
            msg.message.imageMessage
              ?.caption ||
            msg.message.videoMessage
              ?.caption ||
            "";

          const command =
            text
              .trim()
              .toLowerCase();

          console.log("");
          console.log(
            "📩 Message received"
          );

          console.log(
            "👤 Sender:",
            sender
          );

          console.log(
            "💬 Message:",
            text
          );

          // ===============================
          // OWNER CHECK
          // ===============================

          if (!OWNER_NUMBER) {

            console.log(
              "❌ OWNER_NUMBER is missing."
            );

            return;
          }

          if (
            sender !== OWNER_NUMBER
          ) {

            console.log(
              "🚫 Message ignored: sender is not owner."
            );

            return;
          }

          // ===============================
          // PING
          // ===============================

          if (
            command === ".ping"
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "🏓 Pong!\n\n" +
                  "🤖 Mageba-MD is alive!"
              }
            );

            console.log(
              "✅ .ping replied."
            );

            return;
          }

          // ===============================
          // MENU
          // ===============================

          if (
            command === ".menu"
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "🤖 *Mageba-MD Menu*\n\n" +
                  "🏓 .ping\n" +
                  "📋 .menu"
              }
            );

            console.log(
              "✅ .menu replied."
            );

            return;
          }

        } catch (error) {

          console.log(
            "❌ Message handler error:"
          );

          console.log(
            error.message
          );
        }
      }
    );

  } catch (error) {

    console.log(
      "❌ Bot startup error:"
    );

    console.log(
      error.message
    );

    reconnecting = false;

    console.log(
      "🔄 Trying again in 10 seconds..."
    );

    setTimeout(() => {
      startBot();
    }, 10000);
  }
}

// ===============================
// START
// ===============================

startBot();

// ===============================
// KEEP ALIVE LOG
// ===============================

setInterval(() => {

  console.log(
    "💚 Mageba-MD is still running..."
  );

}, 60000);
