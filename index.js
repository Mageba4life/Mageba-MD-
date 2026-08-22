const http = require("http");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const PORT = process.env.PORT || 3000;

const BOT_NUMBER = (process.env.BOT_NUMBER || "").replace(/\D/g, "");
const OWNER_NUMBER = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");

// Render web server
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

let reconnectTimer = null;

async function startBot() {
  try {
    console.log("📱 Starting WhatsApp...");

    const { state, saveCreds } =
      await useMultiFileAuthState("session");

    console.log(
      "🔐 Session registered:",
      state.creds.registered
    );

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      markOnlineOnConnect: true
    });

    sock.ev.on("creds.update", saveCreds);

    // Pairing code
    if (!state.creds.registered) {
      if (!BOT_NUMBER) {
        console.log("❌ BOT_NUMBER is missing.");
        return;
      }

      try {
        console.log("📱 Preparing WhatsApp pairing...");

        await new Promise(resolve => {
          setTimeout(resolve, 5000);
        });

        const code =
          await sock.requestPairingCode(BOT_NUMBER);

        console.log("");
        console.log("=================================");
        console.log("📱 WHATSAPP PAIRING CODE");
        console.log("🔑 CODE:", code);
        console.log("=================================");
        console.log("");
      } catch (error) {
        console.log("❌ Pairing code error:");
        console.log(error.message);
      }
    } else {
      console.log("✅ Existing WhatsApp session found.");
    }

    // Connection
    sock.ev.on("connection.update", update => {
      const {
        connection,
        lastDisconnect
      } = update;

      console.log("🔌 Connection:", connection);

      if (connection === "open") {
        console.log("");
        console.log("=================================");
        console.log("✅ MAGEBA-MD CONNECTED!");
        console.log("🤖 Bot:", BOT_NUMBER);
        console.log("👑 Owner:", OWNER_NUMBER);
        console.log("=================================");
        console.log("");
      }

      if (connection === "close") {
        console.log("❌ WhatsApp connection closed.");

        const statusCode =
          lastDisconnect?.error?.output?.statusCode;

        console.log("Disconnect status:", statusCode);

        if (
          statusCode === DisconnectReason.loggedOut
        ) {
          console.log("⚠️ WhatsApp logged out.");
          return;
        }

        if (!reconnectTimer) {
          console.log("🔄 Reconnecting in 10 seconds...");

          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            startBot();
          }, 10000);
        }
      }
    });

    // Incoming messages
    sock.ev.on("messages.upsert", async event => {
      console.log("");
      console.log("=================================");
      console.log("📩 MESSAGE EVENT RECEIVED");
      console.log("Type:", event.type);
      console.log(
        "Messages:",
        event.messages?.length || 0
      );
      console.log("=================================");

      for (const msg of event.messages || []) {
        try {
          if (!msg || !msg.message) {
            console.log("⚠️ Empty message.");
            continue;
          }

          if (msg.key?.fromMe) {
            console.log("ℹ️ Ignoring bot's own message.");
            continue;
          }

          const jid = msg.key?.remoteJid || "";

          const sender = (
            msg.key?.participant ||
            jid
          )
            .split("@")[0]
            .replace(/\D/g, "");

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            "";

          console.log("👤 Sender:", sender);
          console.log("💬 Text:", text);

          if (!OWNER_NUMBER) {
            console.log("❌ OWNER_NUMBER is missing.");
            continue;
          }

          if (sender !== OWNER_NUMBER) {
            console.log("🚫 Message ignored: not owner.");
            console.log("Expected:", OWNER_NUMBER);
            console.log("Received:", sender);
            continue;
          }

          const command =
            text.trim().toLowerCase();

          // .ping
          if (command === ".ping") {
            console.log("🏓 .ping received!");

            await sock.sendMessage(jid, {
              text:
                "🏓 Pong!\n\n" +
                "🤖 Mageba-MD is alive!\n" +
                "✅ WhatsApp connection is working."
            });

            console.log("✅ Pong sent.");
          }

          // .menu
          if (command === ".menu") {
            console.log("📋 .menu received!");

            await sock.sendMessage(jid, {
              text:
                "🤖 Mageba-MD Menu\n\n" +
                ".ping - Test bot\n" +
                ".menu - Show menu"
            });

            console.log("✅ Menu sent.");
          }

        } catch (error) {
          console.log("❌ Message handler error:");
          console.log(error.message);
        }
      }
    });

  } catch (error) {
    console.log("❌ Bot startup error:");
    console.log(error.message);

    setTimeout(() => {
      startBot();
    }, 10000);
  }
}

startBot();

setInterval(() => {
  console.log("💚 Mageba-MD is still running...");
}, 60000);
