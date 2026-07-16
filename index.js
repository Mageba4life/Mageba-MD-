const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message) return;

    const text = msg.message.conversation || "";

    if (text === ".menu") {
      await sock.sendMessage(msg.key.remoteJid, {
        text:
`╭━━━〔 Mageba-MD 〕━━━╮
┃ 👋 Hello!
┃
┃ .menu - Show menu
┃ .ping - Check bot
╰━━━━━━━━━━━━━━╯`
      });
    }

    if (text === ".ping") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "🏓 Pong! Bot is alive."
      });
    }
  });
}

startBot();
