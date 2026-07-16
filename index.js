const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  if (!sock.authState?.creds?.registered) {
    console.log("Bot starting...");
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("QR CODE GENERATED - Check Railway logs");
    }

    if (connection === "open") {
      console.log("✅ Mageba-MD connected successfully!");
    }

    if (connection === "close") {
      console.log("Connection closed, restarting...");
      startBot();
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
