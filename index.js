const http = require("http");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  Browsers,
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

// ===============================
// BOT
// ===============================

let starting = false;

async function startBot() {

  if (starting) return;

  starting = true;

  try {

    console.log("");
    console.log("🚀 Mageba-MD starting...");

    const { state, saveCreds } =
      await useMultiFileAuthState("session");

    /*
     * IMPORTANT:
     * Get the current WhatsApp Web version.
     * This avoids the stale bundled version problem.
     */

    let version;

    try {

      const latest =
        await fetchLatestWaWebVersion({});

      version = latest.version;

      console.log(
        "🌐 WhatsApp Web version:",
        version.join(".")
      );

    } catch (error) {

      console.log(
        "⚠️ Could not fetch latest WhatsApp Web version."
      );

      console.log(
        error.message
      );
    }

    const socketOptions = {

      auth: state,

      logger: pino({
        level: "silent"
      }),

      printQRInTerminal: false,

      /*
       * Use a canonical browser identity.
       * This is important for pairing-code validation.
       */

      browser: Browsers.macOS("Chrome")

    };

    if (version) {
      socketOptions.version = version;
    }

    const sock =
      makeWASocket(socketOptions);

    sock.ev.on(
      "creds.update",
      saveCreds
    );

    // ===============================
    // PAIRING
    // ===============================

    if (!state.creds.registered) {

      if (!BOT_NUMBER) {

        console.log(
          "❌ BOT_NUMBER is missing."
        );

        starting = false;

        return;
      }

      console.log(
        "📱 Preparing WhatsApp pairing..."
      );

      try {

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
          "❌ Could not generate pairing code:"
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

          console.log(
            "❌ WhatsApp connection closed."
          );

          starting = false;

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
              "⚠️ Delete the session and pair again."
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
    // MESSAGES
    // ===============================

    sock.ev.on(
      "messages.upsert",
      async ({ messages }) => {

        try {

          const msg =
            messages?.[0];

          if (
            !msg ||
            msg.key.fromMe ||
            !msg.message
          ) {
            return;
          }

          const jid =
            msg.key.remoteJid || "";

          const sender = (
            msg.key.participant ||
            jid
          )
            .split("@")[0]
            .replace(/\D/g, "");

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage
              ?.text ||
            msg.message.imageMessage
              ?.caption ||
            msg.message.videoMessage
              ?.caption ||
            "";

          const command =
            text.trim().toLowerCase();

          console.log(
            "📩 Message received:",
            sender,
            text
          );

          // ===============================
          // OWNER CHECK
          // ===============================

          if (!OWNER_NUMBER) {

            console.log(
              "❌ OWNER_NUMBER is missing."
            );

            return;
          }

          if (
            sender !== OWNER_NUMBER
          ) {

            console.log(
              "🚫 Message ignored: not owner."
            );

            return;
          }

          // ===============================
          // PING
          // ===============================

          if (
            command === ".ping"
          ) {

            await sock.sendMessage(
              jid,
              {
                text:
                  "🏓 Pong!\n\n" +
                  "🤖 Mageba-MD is alive!"
              }
            );

            console.log(
              "✅ .ping replied."
            );

            return;
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
              "✅ .menu replied."
            );

            return;
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
      "❌ Startup error:"
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
// KEEP ALIVE
// ===============================

setInterval(() => {

  console.log(
    "💚 Mageba-MD is still running..."
  );

}, 60000);
