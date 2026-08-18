const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Mageba-MD is running!");
}).listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");

const BOT_NUMBER = (process.env.BOT_NUMBER || "").replace(/\D/g, "");
const OWNER_NUMBER = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ Mageba-MD connected!");
      console.log("🤖 Bot number:", BOT_NUMBER);
      console.log("👑 Owner number:", OWNER_NUMBER);
    }

    if (connection === "close") {
      console.log("❌ Connection closed");

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        setTimeout(startBot, 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages?.[0];

      if (!msg || msg.key.fromMe || !msg.message) return;

      const jid = msg.key.remoteJid || "";

      const sender = (
        msg.key.participant ||
        jid ||
        ""
      ).split("@")[0].replace(/\D/g, "");

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      console.log("📩 Message received:", {
        sender,
        text
      });

      if (!OWNER_NUMBER) {
        console.log("❌ OWNER_NUMBER is missing");
        return;
      }

      if (sender !== OWNER_NUMBER) {
        console.log("🚫 Message ignored: not owner");
        return;
      }

      if (text.trim().toLowerCase() === ".ping") {
        await sock.sendMessage(jid, {
          text: "🏓 Pong! Mageba-MD is alive!"
        });
      }

      if (text.trim().toLowerCase() === ".menu") {
        await sock.sendMessage(jid, {
          text:
            "🤖 Mageba-MD Menu\n\n" +
            ".ping - Test bot\n" +
            ".menu - Show menu"
        });
      }

    } catch (error) {
      console.log("❌ Message handler error:", error);
    }
  });
}

startBot();

setInterval(() => {
  console.log("💚 Mageba-MD is still running...");
}, 60000);
