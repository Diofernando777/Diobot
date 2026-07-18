const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

async function startDebug() {
    // CAMBIO: Usamos una carpeta diferente para que no use la sesión de tu bot principal
    const { state, saveCreds } = await useMultiFileAuthState("auth_debug_sesion");
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({ 
        version, 
        auth: state, 
        printQRInTerminal: true // Esto mostrará el QR siempre que no exista la carpeta
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log("\n✅ Escanea este QR para iniciar la sesión de DEBUG:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "open") console.log("✅ SESIÓN DE DEBUG CONECTADA. Enviame un mensaje.");
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message) return;

        const senderId = msg.key.participant || msg.key.remoteJid;
        const pushName = msg.pushName || "Desconocido";
        const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        console.log("\n================ DEBUG =================");
        console.log(`👤 Nombre: ${pushName}`);
        console.log(`🆔 ID (JID): ${senderId}`);
        console.log(`💬 Mensaje: ${msgText}`);
        console.log("=========================================\n");
    });
}

startDebug();