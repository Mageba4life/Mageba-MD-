const http = require("http");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });
  res.end("Mageba-MD diagnostic bot is running!");
}).listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

const OWNER_NUMBER = (process.env.OWNER_NUMBER || "")
  .replace(/\D/g, "");

let reconnectTimer = null;

async function startBot() {
  try {
    console.log("");
    console.log("🚀 Starting Mageba-MD diagnostic...");
    console.log("👑 Owner:", OWNER_NUMBER || "NOT SET");

    const { state, saveCreds } =
      await useMultiFileAuthState("session");

    console.log(
      "🔐 Session registered:",
      state.creds.registered
    );

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    // =================================
    // CONNECTION
    // =================================

    sock.ev.on("connection.update", (update) => {
      console.log("🔌 CONNECTION EVENT:", {
        connection: update.connection,
        hasQR: !!update.qr,
        isNewLogin: update.isNewLogin
      });

      if (update.connection === "open") {
        console.log("");
        console.log("=================================");
        console.log("✅ WHATSAPP CONNECTED");
        console.log("=================================");
        console.log("");
      }

      if (update.connection === "close") {
        console.log("❌ CONNECTION CLOSED");

        const status =
          update.lastDisconnect?.error?.output?.statusCode;

        console.log("Disconnect status:", status);

        if (status === DisconnectReason.loggedOut) {
          console.log("⚠️ WhatsApp logged out.");
          return;
        }

        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            startBot();
          }, 10000);
        }
      }
    });

    // =================================
    // EVERY MESSAGE EVENT
    // =================================

    sock.ev.on("messages.upsert", async (event) => {

      console.log("");
      console.log("=================================");
      console.log("📩 MESSAGES.UPSERT EVENT RECEIVED");
      console.log("Type:", event.type);
      console.log(
        "Number of messages:",
        event.messages?.length || 0
      );
      console.log("=================================");

      for (const msg of event.messages || []) {

        try {

          console.log("🔎 Message key:", {
            id: msg.key?.id,
            remoteJid: msg.key?.remoteJid,
            fromMe: msg.key?.fromMe,
            participant: msg.key?.participant
          });

          if (!msg.message) {
            console.log("⚠️ Message has no message body.");
            continue;
          }

          const jid =
            msg.key?.remoteJid || "";

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

          // Ignore messages sent by the bot itself
          if (msg.key?.fromMe) {
            console.log("ℹ️ Ignoring own message.");
            continue;
          }

          // =================================
          // OWNER CHECK
          // =================================

          if (!OWNER_NUMBER) {
            console.log(
              "❌ OWNER_NUMBER environment variable is empty."
            );
            continue;
          }

          if (sender !== OWNER_NUMBER) {
            console.log(
              "🚫 Message received but sender is not owner."
            );

            console.log(
              "Expected:",
              OWNER_NUMBER
            );

            console.log(
              "Received:",
              sender
            );

            continue;
          }

          const command =
            text.trim().toLowerCase();

          // =================================
          // PING
          // =================================

          if (command === ".ping") {

            console.log("🏓 Processing .ping...");

            await sock.sendMessage(jid, {
              text:
                "🏓 Pong!\n\n" +
                "🤖 Mageba-MD is alive!"
            });

            console.log(
              "✅ Pong message sent."
            );
          }

          // =================================
          // MENU
          // =================================

          if (command === ".menu") {

            console.log("📋 Processing .menu...");

            await sock.sendMessage(jid, {
              text:
                "🤖 Mageba-MD Menu\n\n" +
                ".ping - Test bot\n" +
                ".menu - Show menu"
            });

            console.log(
              "✅ Menu message sent."
            );
          }

        } catch (error) {

          console.log(
            "❌ Error processing message:"
          );

          console.log(
            error.message
          );
        }
      }
    });

    // =================================
    // PRESENCE / CONTACT DEBUGGING
    // =================================

    sock.ev.on("contacts.upsert", (contacts) => {
      console.log(
        "👥 CONTACTS EVENT:",
        contacts?.length || 0
      );
    });

    sock.ev.on("chats.upsert", (chats) => {
      console.log(
        "💬 CHATS EVENT:",
        chats?.length || 0
      );
    });

    sock.ev.on("chats.update", (chats) => {
      console.log(
        "🔄 CHATS UPDATE:",
        chats?.length || 0
      );
    });

    sock.ev.on("presence.update", (update) => {
      console.log(
        "🟢 PRESENCE EVENT:",
        update.id
      );
    });

  } catch (error) {

    console.log(
      "❌ STARTUP ERROR:"
    );

    console.log(
      error.message
    );

    setTimeout(
      startBot,
      10000
    );
  }
}

startBot();

setInterval(() => {
  console.log(
    "💚 Mageba-MD diagnostic service is running..."
  );
}, 60000);
