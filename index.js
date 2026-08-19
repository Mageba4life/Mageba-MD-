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

let starting = false;

async function startBot() {
  if (starting) return;
  starting = true;

  try {
    const { state, saveCreds } =
      await useMultiFileAuthState("session");

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    /*
     * Generate a fresh pairing code
     * when this WhatsApp account is not registered.
     */
    if (!state.creds.registered) {
      if (!BOT_NUMBER) {
        console.log("❌ BOT_NUMBER is missing.");
      } else {
        try {
          console.log("📱 Preparing WhatsApp pairing...");

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
    } else {
      console.log("✅ Existing WhatsApp session found.");
    }

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        console.log("✅ Mageba-MD connected!");
        console.log("🤖 Bot number:", BOT_NUMBER);
        console.log("👑 Owner number:", OWNER_NUMBER);
        starting = false;
      }

      if (connection === "close") {
        console.log("❌ Connection closed");

        starting = false;

        const statusCode =
          lastDisconnect?.error?.output?.statusCode;

        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log("🔄 Reconnecting in 5 seconds...");
          setTimeout(startBot, 5000);
        } else {
          console.log("⚠️ WhatsApp logged out. Pair again.");
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
        )
          .split("@")[0]
          .replace(/\D/g, "");

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

        /*
         * Only OWNER_NUMBER can control the bot.
         */
        if (!OWNER_NUMBER) {
          console.log("❌ OWNER_NUMBER is missing.");
          return;
        }

        if (sender !== OWNER_NUMBER) {
          console.log("🚫 Message ignored: not owner.");
          return;
        }

        const command = text.trim().toLowerCase();

        if (command === ".ping") {
          await sock.sendMessage(jid, {
            text: "🏓 Pong! Mageba-MD is alive!"
          });

          console.log("✅ .ping replied.");
        }

        if (command === ".menu") {
          await sock.sendMessage(jid, {
            text:
              "🤖 Mageba-MD Menu\n\n" +
              ".ping - Test bot\n" +
              ".menu - Show menu"
          });

          console.log("✅ .menu replied.");
        }

      } catch (error) {
        console.log("❌ Message handler error:");
        console.log(error.message);
      }
    });

  } catch (error) {
    console.log("❌ Bot startup error:");
    console.log(error.message);

    starting = false;

    setTimeout(startBot, 5000);
  }
}

startBot();

setInterval(() => {
  console.log("💚 Mageba-MD is still running...");
}, 60000);
