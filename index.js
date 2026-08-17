const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Mageba-MD is running!");
}).listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

console.log("🚀 Mageba-MD starting...");

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

  /*
   * WhatsApp pairing code
   */
  if (!state.creds.registered) {
    if (!BOT_NUMBER) {
      console.log("❌ BOT_NUMBER is missing.");
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const code = await sock.requestPairingCode(BOT_NUMBER);

      console.log("");
      console.log("=================================");
      console.log("📱 WHATSAPP PAIRING CODE");
      console.log("🔑 CODE:", code);
      console.log("=================================");
      console.log("");
    } catch (error) {
      console.log("❌ Could not generate pairing code:");
      console.log(error.message);
    }
  }

  sock.ev.on("connection.update", (update) => {
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
      } else {
        console.log("⚠️ WhatsApp logged out. Pair again.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg || !msg.message) return;

    const sender = (msg.key.participant || msg.key.remoteJid || "")
      .split("@")[0]
      .replace(/\D/g, "");

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    /*
     * Only the OWNER_NUMBER can control the bot.
     */
    if (OWNER_NUMBER && sender !== OWNER_NUMBER) {
      return;
    }

    if (text === ".menu") {
      await sock.sendMessage(msg.key.remoteJid, {
        text:
          "🤖 Mageba-MD Menu\n\n" +
          ".menu\n" +
          ".ping"
      });
    }

    if (text === ".ping") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "🏓 Pong! Bot is alive"
      });
    }
  });
}

startBot();

setInterval(() => {
  console.log("💚 Mageba-MD is still running...");
}, 60000);
