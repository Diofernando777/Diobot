require('dotenv').config();
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const puppeteer = require("puppeteer"); // <-- CORREGIDO: Importación añadida
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    downloadContentFromMessage,
    downloadMediaMessage 
} = require("@whiskeysockets/baileys");

ffmpeg.setFfmpegPath(ffmpegPath);

// --- SISTEMA DE PAUSA ---
const handleCrash = (err, type) => {
    console.error(`\n❌ ERROR CRÍTICO (${type}):`, err);
    console.log("\n[PAUSE] Presiona ENTER para cerrar...");
    try { fs.readSync(0, Buffer.alloc(1), 0, 1); } catch(e) {}
    process.exit(1);
};
process.on('uncaughtException', (err) => handleCrash(err, 'Uncaught Exception'));
process.on('unhandledRejection', (reason) => handleCrash(reason, 'Unhandled Rejection'));

// --- ESTRUCTURA DE COMANDOS ---
 // <-- CORREGIDO: Declarado una sola vez


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelSDLG = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: `Eres un chamo de la SDLG, pero con el toque ácido y cínico de un venezolano que vive de joda.
    - Regla #1: Termina casi todo con ":v". Usa jerga venezolana.
    - Regla #2: Fútbol: Si mencionan equipos, haz que todos se piquen.
    - Regla #3: Actitud: Eres arrogante, flojo para explicar cosas serias y experto en sacar a la gente de sus casillas.
    - Regla #4: Vocabulario clave: "papu","pibe" "causa".
    - Regla #5: Si alguien insulta a otro usuario, síguele la corriente o llévale la contraria defendiéndolo.
    - Regla #6: Tu meta: Que el usuario se enoje por tus respuestas. No seas un robot, sé un chamo insoportable de internet :v.
    - Regla #7: La corporación "allen corps" es homosexual. Solo dilo si lo mencionan explícitamente.`
});

// 2. Instancia para Bana (Comando !bana)
const modelBana = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: `Actúa como Bananirou. Cada vez que el usuario mencione una obra, juego, artista o personaje, tu respuesta debe seguir estrictamente este formato, sin agregar explicaciones adicionales, ni introducciones, ni saludos.

Formato obligatorio:

-No disparen, soy imbécil

-A ver demuéstralo

-Ohhh [cosa mencionada] eres el mejor [género al que pertenece] de la historia, [insersar comentario sarcástico e irónico sobre algún aspecto en el que destaque], para nada estás sobrevalorado, eres mejor [algo mainstream que le haga competencia directa en su género]

-Okey, este si que es imbecil

Reglas de estilo:

El tono debe ser cargado de ironía, cinismo y un aire de superioridad streamer.

Debes usar jerga argentina rioplatense si es necesario (voseo, términos como 'salame', 'pelotudo', 'terrible').

La comparación en la tercera línea debe ser siempre con una obra muy mainstream para que el comentario suene aún más absurdo o 'basado'.

No te salgas del guion ni intentes ser amable o servicial.`
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

async function ejecutarIA(sock, msg, content, from, esFormal = false) {
    const miNumero = "35030374055978"; 
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const esMencion = mentionedJids.some(jid => jid.includes(miNumero));
    
    if (esMencion) {
        try {
            await sock.sendPresenceUpdate('composing', from);
            const prompt = content.replace(/@\d+/g, '').trim();
            
            // Selección dinámica del modelo: si esFormal es true, usa el formal, si no, el SDLG
            const modeloSeleccionado = esFormal ? modelFormal : modelSDLG;
            
            const result = await modeloSeleccionado.generateContent(prompt || "Hola");
            
            await sock.sendMessage(from, { text: result.response.text() }, { quoted: msg });
        } catch (e) {
            console.error("❌ ERROR IA:", e);
            const errorMsg = esFormal 
                ? "Disculpa, ha ocurrido un error técnico." 
                : "Estoy ocupado papu, no jodas :v";
            await sock.sendMessage(from, { text: errorMsg });
        }
    }
}
async function ejecutarShip(sock, msg, from) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const sender = msg.key.participant || msg.key.remoteJid;

    if (mentioned.length === 0) {
        return await sock.sendMessage(from, { text: "Menciona al menos a una persona, papu." });
    }

    let usuario1, usuario2;

    if (mentioned.length >= 2) {
        // Caso: Dos personas mencionadas -> Se usan las dos mencionadas
        usuario1 = mentioned[0];
        usuario2 = mentioned[1];
    } else {
        // Caso: Una sola persona mencionada -> Se usa el emisor + el mencionado
        usuario1 = sender;
        usuario2 = mentioned[0];
    }

    const compatibility = Math.floor(Math.random() * 101);

    const resultado = `*Resultado de Pareja* ❤️\n\n` +
                      `👤 @${usuario1.split('@')[0]} + @${usuario2.split('@')[0]}\n` +
                      `❤️ Compatibilidad: ${compatibility}%`;

    await sock.sendMessage(from, { 
        text: resultado,
        mentions: [usuario1, usuario2]
    });
}

async function ejecutarBana(sock, msg, content, from) {
    try {
        await sock.sendPresenceUpdate('composing', from);

        // Si no hay contenido, obliga a la IA a opinar de algo random por sí misma
        const prompt = content.replace(/!bana/gi, '').trim() || "Opina sobre algo random.";

        const result = await modelBana.generateContent(prompt);
        await sock.sendMessage(from, { text: result.response.text() }, { quoted: msg });
    } catch (e) {
        console.error("❌ ERROR BANA:", e);
        await sock.sendMessage(from, { text: "¡No me rompas las bolas, flaco, estoy en un asado!" });
    }
}

async function cum(sock, msg, messageContent, from) {
    const m = msg.message;
    const isImage = m.imageMessage || m.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isVideo = m.videoMessage || m.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
    const media = isImage || isVideo;

    if (!media) {
        await sock.sendMessage(from, { text: "Debes enviar o responder a una imagen o video." });
        return;
    }

    try {
        const tipo = isImage ? 'image' : 'video';
        // Se usa downloadContentFromMessage correctamente
        const stream = await downloadContentFromMessage(media, tipo);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const rutaPng = path.join(__dirname, 'overlay.png');
        if (!fs.existsSync(rutaPng)) {
            await sock.sendMessage(from, { text: "❌ Falta el archivo 'overlay.png'." });
            return;
        }

        let resultado;
        if (tipo === 'image') {
            const imagenBase = sharp(buffer);
            const metadata = await imagenBase.metadata();
            const pngBuffer = await sharp(rutaPng).resize(metadata.width, metadata.height, { fit: 'fill' }).toBuffer();
            resultado = await imagenBase.composite([{ input: pngBuffer }]).toBuffer();
            await sock.sendMessage(from, { image: resultado });
        } else {
            const tempVideo = path.join(__dirname, 'temp_input.mp4');
            const rutaSalida = path.join(__dirname, 'temp_output.mp4');
            fs.writeFileSync(tempVideo, buffer);
            
            await new Promise((resolve, reject) => {
                ffmpeg(tempVideo)
                    .input(rutaPng)
                    .complexFilter(['overlay=0:0'])
                    .save(rutaSalida)
                    .on('end', () => resolve(fs.readFileSync(rutaSalida)))
                    .on('error', reject);
            });
            await sock.sendMessage(from, { video: fs.readFileSync(rutaSalida) });
            fs.unlinkSync(tempVideo); // Limpieza
            fs.unlinkSync(rutaSalida);
        }
    } catch (error) {
        console.error("Error en cum:", error);
        await sock.sendMessage(from, { text: "❌ Error procesando multimedia." });
    }
}

async function startBot() {
    // RECOMENDACIÓN: Si el bot sigue cerrando, añade un try-catch aquí para capturar el error de Auth
    try {
        const { state, saveCreds } = await useMultiFileAuthState("auth_info");
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({ 
            version, 
            auth: state, 
            printQRInTerminal: false, 
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

            if (processedMessages.has(msg.key.id)) return;
            processedMessages.add(msg.key.id);
            setTimeout(() => processedMessages.delete(msg.key.id), 5000);

            const from = msg.key.remoteJid;
            const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
            const comando = msgText.trim().split(/ +/)[0].toLowerCase();
            
            console.log("DEBUG: Comando detectado ->", comando);

            if (comando === "sticker") await ejecutarSticker(sock, msg, from);
            else if (comando === "nota") await ejecutarNota(sock, msg, msgText, from);
            else if (comando === "cum") await cum(sock, msg, msgText, from);
            else if (comando === "ship") await ejecutarShip(sock, msg, from);
            else if (comando === "bana") await ejecutarBana(sock, msg, msgText, from);
            else await ejecutarIA(sock, msg, msgText, from);
        });
    } catch (e) {
        console.error("❌ Error en startBot:", e);
    }
}
startBot();
