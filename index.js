const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  if (!sock.authState?.creds?.registered) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question("Enter WhatsApp number with country code: ", async (number) => {
      const code = await sock.requestPairingCode(number);
      console.log("Your pairing code:", code);
      rl.close();
    });
  }

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log("✅ Mageba-MD connected!");
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
