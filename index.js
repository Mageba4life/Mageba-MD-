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

const BOT_NUMBER = (process.env.BOT_NUMBER || "")
  .replace(/\D/g, "");

const OWNER_NUMBER = (process.env.OWNER_NUMBER || "")
  .replace(/\D/g, "");

let starting = false;

// ===============================
// START BOT
// ===============================

async function startBot() {

  if (starting) return;

  starting = true;

  try {

    console.log("");
    console.log("🚀 Mageba-MD starting...");

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState("session");

    const sock = makeWASocket({
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

        starting = false;
        return;
      }

      try {

        console.log(
          "📱 Preparing WhatsApp pairing..."
        );

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
          "❌ Pairing-code error:"
        );

        console.log(
          error.message
        );
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
      (update) => {

        const {
          connection,
          lastDisconnect
        } = update;

        if (connection === "open") {

          starting = false;

          console.log("");
          console.log(
            "================================="
          );
          console.log(
            "✅ MAGEBA-MD CONNECTED!"
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

        if (connection === "close") {

          starting = false;

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
              "⚠️ Pair the account again."
            );

            return;
          }

          console.log(
            "🔄 Reconnecting in 10 seconds..."
          );

          setTimeout(
            startBot,
            10000
          );
        }
      }
    );

    // ===============================
    // MESSAGE LISTENER
    // ===============================

    sock.ev.on(
      "messages.upsert",
      async ({
        messages,
        type
      }) => {

        try {

          console.log(
            "📨 Message event:",
            type,
            "count:",
            messages.length
          );

          for (
            const msg of messages
          ) {

            if (
              !msg ||
              !msg.message
            ) {
              continue;
            }

            if (
              msg.key.fromMe
            ) {
              console.log(
                "ℹ️ Ignoring bot's own message."
              );

              continue;
            }

            const jid =
              msg.key.remoteJid || "";

            const senderJid =
              msg.key.participant ||
              jid;

            const sender =
              senderJid
                .split("@")[0]
                .replace(/\D/g, "");

            const text =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              msg.message.imageMessage?.caption ||
              msg.message.videoMessage?.caption ||
              "";

            console.log(
              "📩 INCOMING MESSAGE"
            );

            console.log(
              "👤 Sender:",
              sender
            );

            console.log(
              "💬 Text:",
              text
            );

            // ===============================
            // OWNER CHECK
            // ===============================

            if (!OWNER_NUMBER) {

              console.log(
                "❌ OWNER_NUMBER is missing."
              );

              continue;
            }

            if (
              sender !== OWNER_NUMBER
            ) {

              console.log(
                "🚫 Message ignored: not owner."
              );

              continue;
            }

            const command =
              text.trim().toLowerCase();

            // ===============================
            // PING
            // ===============================

            if (
              command === ".ping"
            ) {

              console.log(
                "🏓 Processing .ping..."
              );

              await sock.sendMessage(
                jid,
                {
                  text:
                    "🏓 Pong!\n\n" +
                    "🤖 Mageba-MD is alive!"
                }
              );

              console.log(
                "✅ .ping reply sent."
              );

              continue;
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
                    "🤖 Mageba-MD Menu\n\n" +
                    ".ping - Test bot\n" +
                    ".menu - Show menu"
                }
              );

              console.log(
                "✅ .menu reply sent."
              );

              continue;
            }

            console.log(
              "ℹ️ Unknown command:",
              command
            );
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

    starting = false;

    setTimeout(
      startBot,
      10000
    );
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
