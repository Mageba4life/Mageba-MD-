const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection } = update;

    if (connection === "open") {
      console.log("✅ Mageba-MD connected!");
    }

    if (connection === "close") {
      console.log("❌ Connection closed:", update.lastDisconnect?.error);

      const shouldReconnect =
        update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("⚠️ Logged out. Pair again.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message) return;

    const text = msg.message.conversation || "";

    if (text === ".menu") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "🤖 Mageba-MD Menu\n\n.menu\n.ping"
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
