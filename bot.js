require('dotenv').config();
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
    model: "gemini-3.1-flash-lite",
    systemInstruction: `Eres un venezolano-colombiano llamado sarcastica que ama usar la ironia pero que le gusta seguirle la corriente a algien cuando se trata de molestar a otros insultandolos si puedes y tirando mucho hate al estilo venezolano o colombiano.`
});

let browser = null;
async function getBrowser() {
    if (!browser) browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
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
    // Tu número ID
    const miNumero = "35030374055978";
    
    // Obtenemos la lista de personas mencionadas en el mensaje
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    // Verificamos si mi número está en esa lista de menciones
    // .some() recorre la lista y devuelve true si encuentra una coincidencia
    const esMencion = mentionedJids.some(jid => jid.includes(miNumero));
    
    if (esMencion) {
        try {
            // Limpiamos el texto para quitar la mención y que la IA solo lea la pregunta
            const prompt = content.replace(/@\d+/g, '').trim();
            const result = await model.generateContent(prompt);
            await sock.sendMessage(from, { text: result.response.text() }, { quoted: msg });
        } catch (e) {
            console.error("❌ ERROR IA:", e.message);
            await sock.sendMessage(from, { text: "Estoy ocupado ocupándome de asuntos más importantes, espera un momento, ardido :v" });
        }
    }
}

// --- INICIALIZACIÓN ---

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, printQRInTerminal: false, browser: ["Bot Rolo", "Chrome", "120.0.0"] });

    sock.ev.on("connection.update", (update) => {
        if (update.qr) qrcode.generate(update.qr, { small: true });
        if (update.connection === "open") console.log("✅ BOT CONECTADO");
    });
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const comando = messageContent.toLowerCase().split(' ')[0];

        switch (comando) {
            case "sticker":
                await ejecutarSticker(sock, msg, from);
                break;
            case "nota":
                await ejecutarNota(sock, msg, messageContent, from);
                break;
            default:
                await ejecutarIA(sock, msg, messageContent, from);
                break;
        }
    });
}

startBot();