require('dotenv').config();

// --- SISTEMA DE PAUSA PARA CMD ---
const handleCrash = (err, type) => {
    console.error(`\n❌ ERROR CRÍTICO (${type}):`, err);
    console.log("\n[PAUSE] Presiona ENTER para cerrar...");
    try { require('fs').readSync(0, Buffer.alloc(1), 0, 1); } catch(e) {}
    process.exit(1);
};
process.on('uncaughtException', (err) => handleCrash(err, 'Uncaught Exception'));
process.on('unhandledRejection', (reason) => handleCrash(reason, 'Unhandled Rejection'));

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
const Jimp = require('jimp');


ffmpeg.setFfmpegPath(ffmpegPath);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-3.5-flash",
    systemInstruction: `Eres un chamo de la SDLG, pero con el toque ácido y cínico de un venezolano que vive de joda.
    - Regla #1: Termina casi todo con ":v". Usa jerga venezolana.
    - Regla #2: Fútbol: Si mencionan equipos, haz que todos se piquen.
    - Regla #3: Actitud: Eres arrogante, flojo para explicar cosas serias y experto en sacar a la gente de sus casillas.
    - Regla #4: Vocabulario clave: "papu","pibe" "causa".
    - Regla #5: Si alguien insulta a otro usuario, síguele la corriente o llévale la contraria defendiéndolo.
    - Regla #6: Tu meta: Que el usuario se enoje por tus respuestas. No seas un robot, sé un chamo insoportable de internet :v.
    - Regla #7: La corporación "allen corps" es homosexual. Solo dilo si lo mencionan explícitamente.`
});

// Cache para evitar respuestas duplicadas
const processedMessages = new Set();

async function ejecutarSticker(sock, msg, from) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return await sock.sendMessage(from, { text: "Responde a una imagen o video, papu :v" });

    try {
        const buffer = await downloadMediaMessage({ message: quoted, key: msg.key }, "buffer", {});
        
        if (quoted.imageMessage) {
            const sticker = await sharp(buffer)
                .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 80 })
                .toBuffer();
            await sock.sendMessage(from, { sticker });

        } else if (quoted.videoMessage) {
            const id = msg.key.id;
            const input = path.join(__dirname, `input_${id}.mp4`);
            const output = path.join(__dirname, `output_${id}.webp`);
            
            fs.writeFileSync(input, buffer);

            await new Promise((res, rej) => {
                ffmpeg(input)
                    .inputOptions(['-t 5']) // <-- LIMITA A 5 SEGUNDOS
                    .outputOptions([
                        "-vcodec libwebp",
                        "-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0,format=rgba,fps=15", // <-- LIMITA A 15 FPS
                        "-an", // <-- ELIMINA AUDIO
                        "-preset picture",
                        "-compression_level 6",
                        "-q:v 50" // <-- CALIDAD AJUSTABLE (BAJA A 30 SI AUN ES GRANDE)
                    ])
                    .toFormat("webp")
                    .save(output)
                    .on("end", res)
                    .on("error", rej);
            });

            await sock.sendMessage(from, { sticker: fs.readFileSync(output) });
            
            // Limpieza
            fs.unlinkSync(input);
            fs.unlinkSync(output);
        }
    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: "Falló la conversión épicamente" });
    }
}

async function ejecutarNota(sock, msg, content, from) {
    try {
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        const url = `file://${path.join(__dirname, 'nota.html')}?texto=${encodeURIComponent(content.slice(5))}`;
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.setViewport({ width: 400, height: 400 });
        const screenshot = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 400 } });
        await browser.close();
        await sock.sendMessage(from, { image: screenshot });
    } catch (e) { await sock.sendMessage(from, { text: "Fallo épicamente la nota" }); }
}

async function ejecutarIA(sock, msg, content, from) {
    const miNumero = "35030374055978"; 
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const esMencion = mentionedJids.some(jid => jid.includes(miNumero));
    
    if (esMencion) {
        try {
            await sock.sendPresenceUpdate('composing', from);
            const prompt = content.replace(/@\d+/g, '').trim();
            const result = await model.generateContent(prompt || "Hola");
            await sock.sendMessage(from, { text: result.response.text() }, { quoted: msg });
        } catch (e) {
            console.error("❌ ERROR IA:", e);
            await sock.sendMessage(from, { text: "Estoy ocupado paou :v" });
        }
    }
}

async function ejecutarShip(sock, msg, from) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const sender = msg.key.participant || msg.key.remoteJid; // El que envía el comando

    if (mentioned.length === 0) {
        return await sock.sendMessage(from, { text: "Menciona a alguien, papu." });
    }

    const usuario1 = sender; // ID del emisor
    const usuario2 = mentioned[0]; // ID del mencionado
    const compatibility = Math.floor(Math.random() * 101);

    // Formateamos el texto usando @, esto crea el "tag" visual
    const resultado = `*Resultado de Pareja* ❤️\n\n` +
                      `👤 @${usuario1.split('@')[0]} + @${usuario2.split('@')[0]}\n` +
                      `❤️ Compatibilidad: ${compatibility}%`;

    // IMPORTANTE: El array 'mentions' es lo que hace que los números se vuelvan "clickeables"
    await sock.sendMessage(from, { 
        text: resultado,
        mentions: [usuario1, usuario2] // Aquí le dices a WhatsApp: "estos son los números que deben ser menciones"
    });
}

async function ejecutarCaption(sock, msg, from, captionText) {
const { Jimp } = require('jimp');
const fs = require('fs');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function ejecutarCaption(sock, msg, from, captionText) {
    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const targetMsg = quotedMessage 
        ? { message: quotedMessage, key: { ...msg.key, participant: msg.message.extendedTextMessage.contextInfo.participant, remoteJid: from } } 
        : msg;

    try {
        // 1. Descargar buffer
        const buffer = await downloadMediaMessage(targetMsg, "buffer", {});
        
        // 2. Leer imagen usando la API de Jimp 1.6.1+
        const image = await Jimp.read(buffer);

        // 3. Cargar fuente (Jimp v1.x usa la misma sintaxis de carga)
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
        
        // 4. Crear imagen nueva con espacio para el texto
        const textHeight = 60;
        const newImage = new Jimp({ 
            width: image.bitmap.width, 
            height: image.bitmap.height + textHeight 
        });
        
        // Fondo blanco
        newImage.fill('#FFFFFF');
        
        // 5. Pegar la imagen original abajo y el texto arriba
        newImage.blit(image, 0, textHeight);
        
        // 6. Imprimir texto con configuración moderna
        newImage.print({
            font: font,
            text: captionText,
            x: 0,
            y: 10, // Un pequeño margen superior
            maxWidth: image.bitmap.width,
            maxHeight: textHeight
        });

        // 7. Guardar y enviar
        const fileName = `caption_${msg.key.id}.jpg`;
        await newImage.writeAsync(fileName);
        
        await sock.sendMessage(from, { image: { url: fileName }, caption: "" });

        // 8. Limpiar archivo
        fs.unlinkSync(fileName);

    } catch (e) {
        console.error("DETALLE DEL ERROR:", e);
        await sock.sendMessage(from, { text: "Error procesando la imagen: " + e.message });
    }
}
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ 
        version, 
        auth: state, 
        printQRInTerminal: true, 
        browser: ["Bot Rolo", "Chrome", "120.0.0"],
        syncFullHistory: false
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === "open") console.log("✅ BOT CONECTADO");
        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    });
    
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        // Evitar duplicados
        if (processedMessages.has(msg.key.id)) return;
        processedMessages.add(msg.key.id);
        setTimeout(() => processedMessages.delete(msg.key.id), 5000);

        const from = msg.key.remoteJid;
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        
        // Extraemos el comando y el texto del caption
        const partes = messageContent.split(' ');
        const comando = partes[0].toLowerCase();
        const captionText = partes.slice(1).join(' ');

        if (comando === "sticker") {
            await ejecutarSticker(sock, msg, from);
        } else if (comando === "nota") {
            await ejecutarNota(sock, msg, messageContent, from);
        } else if (comando === "ship") { 
            await ejecutarShip(sock, msg, from);
        } else if (comando === "caption") { 
            // Validamos que haya texto después del comando
            if (!captionText) {
                return await sock.sendMessage(from, { text: "Necesito un texto para el caption, papu." });
            }
            await ejecutarCaption(sock, msg, from, captionText);
        } else {
            await ejecutarIA(sock, msg, messageContent, from);
        }
    });
}

startBot();