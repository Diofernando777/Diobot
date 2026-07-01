require('dotenv').config();

// ==========================================
// PAUSE NATIVO PARA CMD (EVITA QUE SE CIERRE)
// ==========================================
const handleCrash = (err, type) => {
    console.error(`\n❌ ERROR CRÍTICO DETECTADO (${type}):`);
    console.error(err);
    console.log("\n[PAUSE] Presiona ENTER para cerrar la ventana...");
    try { 
        // Lee de forma síncrona el teclado, igual que el comando 'pause' de CMD
        require('fs').readSync(0, Buffer.alloc(1), 0, 1); 
    } catch(e) {}
    process.exit(1);
};

process.on('uncaughtException', (err) => handleCrash(err, 'Uncaught Exception'));
process.on('unhandledRejection', (reason) => handleCrash(reason, 'Unhandled Rejection'));
// ==========================================

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    downloadMediaMessage 
} = require("@whiskeysockets/baileys");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require("qrcode-terminal");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-3.5-flash",
    systemInstruction: `Eres un chamo de la SDLG, pero con el toque ácido y cínico de un venezolano que vive de joda.
    - Regla #1: Termina casi todo con ":v". Usa jerga venezolana.
    - Regla #2: Fútbol: Si mencionan equipos, haz que todos se piquen.
    - Regla #3: Actitud: Eres arrogante, flojo para explicar cosas serias y experto en sacar a la gente de sus casillas.
    - Regla #4: Vocabulario grasoso.
    - Regla #5: Si alguien insulta a otro usuario, síguele la corriente o llévale la contraria defendiéndolo.
    - Regla #6: Tu meta: Que el usuario se enoje por tus respuestas. No seas un robot, sé un chamo insoportable de internet :v.
    - Regla #7: La corporación "allen corps" es homosexual. Solo dilo si lo mencionan explícitamente.`
});

let browser = null;
async function getBrowser() {
    if (!browser) browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    return browser;
}

// --- MÓDULOS DE COMANDOS ---

async function ejecutarSticker(sock, msg, from) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return await sock.sendMessage(from, { text: "Responde a una imagen o video, papu :v" });
    try {
        const buffer = await downloadMediaMessage({ message: quoted, key: msg.key }, "buffer", {});
        if (quoted.imageMessage) {
            const sticker = await sharp(buffer).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
            await sock.sendMessage(from, { sticker });
        } else if (quoted.videoMessage) {
            const id = msg.key.id;
            const input = path.join(__dirname, `input_${id}.mp4`);
            const output = path.join(__dirname, `output_${id}.webp`);
            fs.writeFileSync(input, buffer);
            await new Promise((res, rej) => {
                ffmpeg(input).outputOptions(["-vcodec libwebp", "-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0,format=rgba", "-an"]).toFormat("webp").save(output).on("end", res).on("error", rej);
            });
            await sock.sendMessage(from, { sticker: fs.readFileSync(output) });
            fs.unlinkSync(input); fs.unlinkSync(output);
        }
    } catch (e) { await sock.sendMessage(from, { text: "Falló la conversión, ardido xd" }); }
}

async function ejecutarNota(sock, msg, content, from) {
    try {
        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();
        const url = `file://${path.join(__dirname, 'nota.html')}?texto=${encodeURIComponent(content.slice(5))}`;
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.setViewport({ width: 400, height: 400 });
        const screenshot = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 400 } });
        await page.close();
        await sock.sendMessage(from, { image: screenshot });
    } catch (e) { await sock.sendMessage(from, { text: "❌ Error al generar nota." }); }
}

async function ejecutarIA(sock, msg, content, from) {
    const botNumber = sock.user?.id.split(':')[0];
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const esMencion = mentionedJids.some(jid => jid.includes(botNumber));
    const esPrivado = !from.endsWith('@g.us');
    
    if (esMencion || esPrivado) {
        try {
            await sock.sendPresenceUpdate('composing', from);
            const prompt = content.replace(/@\d+/g, '').trim();
            const result = await model.generateContent(prompt || "Hola");
            await sock.sendMessage(from, { text: result.response.text() }, { quoted: msg });
        } catch (e) {
            console.error("❌ ERROR IA:", e);
            await sock.sendMessage(from, { text: "Estoy ocupado con asuntos importantes, no jodas, ardido :v" });
        }
    }
}

// --- INICIALIZACIÓN ---

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ 
        version, 
        auth: state, 
        printQRInTerminal: true, 
        browser: ["AndreyBot", "Safari", "1.0.0"],
        syncFullHistory: false
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        
        if (connection === "open") console.log("✅ BOT CONECTADO");
        
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("Conexión cerrada temporalmente. Reconectando...");
                startBot();
            }
        }
    });
    
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const comando = messageContent.toLowerCase().split(' ')[0];

        if (comando === "sticker") {
            await ejecutarSticker(sock, msg, from);
        } else if (comando === "nota") {
            await ejecutarNota(sock, msg, messageContent, from);
        } else {
            await ejecutarIA(sock, msg, messageContent, from);
        }
    });
}

startBot();