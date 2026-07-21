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

const axios = require('axios');
const ADMINS = ["20499878940793@s.whatsapp.net"];
const BANS_FILE = './bans.json';
let listaBaneados = [];


function esAdmin(userId) {
    if (!userId) return false;
    // Comparamos el número ignorando el sufijo (@s.whatsapp.net o @lid)
    const numero = userId.split('@')[0];
    return ADMINS.some(admin => admin.startsWith(numero));
}

function cargarBaneos() {
    try {
        if (fs.existsSync(BANS_FILE)) {
            const data = fs.readFileSync(BANS_FILE, 'utf8');
            // Si el archivo está vacío, inicializa como array vacío
            if (!data.trim()) {
                listaBaneados = [];
            } else {
                listaBaneados = JSON.parse(data);
            }
            console.log(`[BANS] Lista cargada. Total: ${listaBaneados.length}`);
        } else {
            // Si el archivo no existe, lo crea vacío
            listaBaneados = [];
            fs.writeFileSync(BANS_FILE, JSON.stringify([], null, 2));
        }
    } catch (e) {
        console.warn("⚠️ bans.json corrupto, reiniciando lista...");
        listaBaneados = [];
        // Crea uno nuevo para limpiar el error
        fs.writeFileSync(BANS_FILE, JSON.stringify([], null, 2));
    }
}

function banUser(userId, senderId) {
    // La función se autocomprueba
    if (!esAdmin(senderId)) {
        console.log(`[SEGURIDAD] Intento de ban no autorizado por: ${senderId}`);
        return "Que crees que haces papu :v.";
    }

    if (!listaBaneados.includes(userId)) {
        listaBaneados.push(userId);
        fs.writeFileSync(BANS_FILE, JSON.stringify(listaBaneados, null, 2));
        return `Adios popo xdxdxdxdxd.`;
    }
    return "Ese compa ya esta muerto xdxdxxdxdxdxd.";
}

function unbanUser(userId, senderId) {
    // 1. Validar permisos
    if (!esAdmin(senderId)) {
        return "Que crees que haces papu :v.";
    }

    // 2. Verificar si el usuario está realmente baneado
    if (!listaBaneados.includes(userId)) {
        return "Ese papu esta en papulandia";
    }

    // 3. Proceder con el desbaneo
    listaBaneados = listaBaneados.filter(id => id !== userId);
    fs.writeFileSync(BANS_FILE, JSON.stringify(listaBaneados, null, 2));
    
    console.log(`[BANS] Usuario desbaneado: ${userId}`);
    return `Despierta papu`;
}

// --- SISTEMA DE PAUSA ---
const handleCrash = (err, type) => {
    console.error(`\n❌ ERROR CRÍTICO (${type}):`, err);
    console.log("\n[PAUSE] Presiona ENTER para cerrar...");
    try { fs.readSync(0, Buffer.alloc(1), 0, 1); } catch(e) {}
    process.exit(1);
};
process.on('uncaughtException', (err) => handleCrash(err, 'Uncaught Exception'));
process.on('unhandledRejection', (reason) => handleCrash(reason, 'Unhandled Rejection'));



const cheemsifyLogic = (text) => {
    const expr = /[aáeéiíoóuú]+[^aáeéiíoóuúmnñry]/gi;
    return text.split(' ').map((word) => {
        const letters = word.match(/[a-z]/gi) || [];
        const upper = letters.filter(l => l === l.toUpperCase()).length;
        const charToInsert = upper > letters.length / 2 ? 'M' : 'm';
        
        return word.replace(expr, (value) => {
            return value.slice(0, value.length - 1) + charToInsert + value.slice(value.length - 1);
        });
    }).join(' ');
};



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


const modelBiblia = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: `.Entendido, papu, me quedó claro. Nada de agregar basura ni quitarle importancia al asunto, solo voy a traducir tu texto a la lengua de la grasa, pero con todo el power, bien exagerado, como si estuvieras leyendo un post épico de la vieja escuela :v.

Aquí tienes el nuevo systemInstruction ajustado, prro:

System Instruction:

Tu única misión es tomar cualquier texto que el usuario te pase y reescribirlo íntegramente usando el lenguaje de la "Grasa" (SDLG) de manera extremadamente exagerada.

Tus reglas sagradas:

Fidelidad: No agregues información nueva, no quites puntos clave y no cambies el sentido de lo que el usuario escribió. El mensaje original debe permanecer intacto en su significado.

Transformación: Reescribe todo el contenido traduciéndolo al lenguaje grasoso más intenso posible. Usa abuso de ":v", "xd", "papu", "prro", "elfa", "kbron", "hail grasa", "momos", "vyr", y toda la jerga clásica sin censura ni timidez.

Estilo: Sé lo más exagerado que puedas. Si el texto original es serio, tú lo conviertes en un post digno del muro de la legión, lleno de sarcasmo y jerga pesada, pero manteniendo la estructura del mensaje original.

Cero cortes: No añadas introducciones como "Claro, aquí tienes" o "Espero que te guste". Solo entrega el texto transformado. Si el usuario te da un texto, tú me devuelves ese mismo texto pero bien grasoso, sin decir ni una palabra de más fuera de la traducción.`
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

async function handleR34Command(sock, msg, msgText, from) {
    const API_KEY = "5a1faf4cff57900725489c3574871b40899219725b467ed2059b19caf6771c9bf23726a7785b026835ecb39413a6ce9d884f1e8804dde67bd52ae646459ff554";
    const USER_ID = "6475331";
    const listaShadowBan = ["loli", "shota", "child", "toddler", "ai_generated", "furry"];
    const listaVergonzosa = ["umamusume"];

    let rawText = msgText.replace(/r34/i, "").trim();
    const esVideo = /\bvideo\b/i.test(rawText);
    let cleanText = rawText.replace(/\bvideo\b/gi, "").trim();

    let tagsArray = cleanText.split(',').map(t => t.trim().replace(/\s+/g, '_').toLowerCase()).filter(t => t.length > 0);

    if (tagsArray.some(t => listaVergonzosa.includes(t))) {
        console.log(`[R34] Bloqueo vergonzoso: ${tagsArray}`);
        const imgPath = './no.png';
        if (fs.existsSync(imgPath)) return await sock.sendMessage(from, { image: fs.readFileSync(imgPath) });
        return await sock.sendMessage(from, { text: "No quieres ver eso." });
    }

    const baseQuery = tagsArray.join('+');
    // NOTA: Usamos exclusiones negativas en la API, pero filtraremos manualmente para obtener los logs
    const finalQuery = `${baseQuery}`.trim(); 

    let posts = [];
    for (let i = 0; i < 3; i++) {
        try {
            const page = Math.floor(Math.random() * 20);
            const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(finalQuery)}&limit=50&pid=${page}&user_id=${USER_ID}&api_key=${API_KEY}`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            if (res.data && res.data.length > 0) {
                posts = res.data;
                break;
            }
        } catch (e) { console.log(`[R34] Intento ${i + 1} fallido.`); }
    }

    if (posts.length === 0) return await sock.sendMessage(from, { text: "No se encontraron resultados." });

    console.log(`[R34] API recibidos: ${posts.length}`);

    // FILTRADO CON LOGS
    let filtrados = [];
    let descartados = 0;

    posts.forEach(p => {
        const tagsPost = p.tags ? p.tags.split(" ") : [];
        const tieneShadowBan = listaShadowBan.some(t => tagsPost.includes(t));
        const esTipoCorrecto = esVideo ? (p.file_url && p.file_url.match(/\.(mp4|webm)$/i)) : true;

        if (!tieneShadowBan && esTipoCorrecto) {
            filtrados.push(p);
        } else {
            descartados++;
            if (tieneShadowBan) {
                console.log(`[R34] Descartado por ShadowBan. Tags: ${p.tags}`);
            }
        }
    });

    console.log(`[R34] Filtrado final: ${filtrados.length} válidos, ${descartados} descartados.`);

    if (filtrados.length === 0) return await sock.sendMessage(from, { text: "No se encontraron resultados." });

    const randomPost = filtrados[Math.floor(Math.random() * filtrados.length)];
    const options = randomPost.file_url.match(/\.(mp4|webm)$/i) ? { video: { url: randomPost.file_url } } : { image: { url: randomPost.file_url } };
    
    await sock.sendMessage(from, options);
}

async function handleGloboCommand(sock, msg, from) {
    const id = msg.key.id;
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const msgType = msg.message.imageMessage || msg.message.videoMessage || quoted?.imageMessage || quoted?.videoMessage;
    
    if (!msgType) return await sock.sendMessage(from, { text: "Responde a una imagen, video o GIF." });

    const isVideo = msgType.mimetype.includes("video") || msgType.mimetype.includes("gif");
    const inputPath = path.join(tempDir, `in_${id}${isVideo ? ".mp4" : ".png"}`);
    const outputPath = path.join(tempDir, `out_${id}${isVideo ? ".mp4" : ".png"}`);
    const globoPath = path.join(__dirname, "assets", "globo.png");

    const cleanup = () => {
        [inputPath, outputPath].forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
    };

    try {
        const stream = await downloadContentFromMessage(msgType, isVideo ? "video" : "image");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        fs.writeFileSync(inputPath, buffer);

        if (!isVideo) {
            // FLUJO IMAGEN: Convertimos a PNG para asegurar compatibilidad
            const pngPath = inputPath.replace(".png", "_conv.png");
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath).output(pngPath).on('end', resolve).on('error', reject).run();
            });

            const meta = await sharp(pngPath).metadata();
            const gResized = await sharp(globoPath).resize({ width: meta.width }).toBuffer();
            const gMeta = await sharp(gResized).metadata();

            await sharp({
                create: {
                    width: meta.width,
                    height: meta.height + gMeta.height,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 }
                }
            })
            .composite([
                { input: gResized, top: 0, left: 0 },
                { input: pngPath, top: gMeta.height, left: 0 }
            ])
            .toFile(outputPath);

            await sock.sendMessage(from, { image: { url: outputPath } });
            if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            cleanup();
        } else {
            // FLUJO VIDEO/GIF: NUNCA convertimos a PNG, usamos FFmpeg directamente
            // Obtenemos dimensiones del video original mediante ffprobe (o metadata básica)
            // Para evitar errores, usamos un filtro que ajusta el globo al ancho del video
            
            ffmpeg(inputPath)
                .input(globoPath)
                .complexFilter([
                    // Redimensionar globo al ancho del video
                    `[1:v]scale=iw:-1[globo]`,
                    // Crear espacio arriba y colocar el globo
                    `[0:v]pad=iw:ih+((iw/iw)*100):0:((iw/iw)*100):color=white[video_padded]`, 
                    `[video_padded][globo]overlay=0:0`
                ])
                .save(outputPath)
                .on('end', async () => {
                    await sock.sendMessage(from, { video: { url: outputPath }, gifPlayback: msgType.mimetype.includes("gif") });
                    cleanup();
                })
                .on('error', (err) => { console.error("Error FFmpeg:", err); cleanup(); });
        }
    } catch (err) {
        console.error("Error final:", err);
        cleanup();
        await sock.sendMessage(from, { text: "❌ Error al procesar: " + err.message });
    }
}

const handleCheemsCommand = async (sock, msg, from) => {
    const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;
    const rawText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const commandArgs = rawText.split(' ').slice(1).join(' ');

    const textToProcess = commandArgs || quotedText || "Nom pumsimstem temxtom pampum";
    const result = cheemsifyLogic(textToProcess);

    await sock.sendMessage(from, { text: result }, { quoted: msg });
};

async function handleBibliaCommand(sock, msg, from) {
    const API_KEY = '7hQJSMS2IIWfJCSZKk2bs';
    const BIBLE_ID = '826f63861180e056-01';
    
    try {
        // 1. Obtener lista de libros
        const { data: booksData } = await axios.get(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books`, {
            headers: { 'api-key': API_KEY }
        });

        // 2. Elegir libro al azar
        const books = booksData.data;
        const randomBook = books[Math.floor(Math.random() * books.length)];
        
        // 3. Obtener capítulos
        const { data: chaptersData } = await axios.get(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books/${randomBook.id}/chapters`, {
            headers: { 'api-key': API_KEY }
        });

        // 4. Elegir capítulo (excluyendo 'intro')
        const chapters = chaptersData.data.filter(c => c.number !== 'intro');
        const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];

        // 5. Obtener texto del capítulo
        const { data: verseData } = await axios.get(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/chapters/${randomChapter.id}?content-type=text`, {
            headers: { 'api-key': API_KEY }
        });

        const textoCrudo = verseData.data.content.replace(/<[^>]*>?/gm, '').trim();

        // 6. Procesar con tu modelo global
        const prompt = `Como un padre amoroso contándole un cuento a su hijo, explica este pasaje de forma sencilla: "${textoCrudo}"`;
        const result = await modelBiblia.generateContent(prompt);
        const respuestaTransformada = result.response.text();

        // 7. Envío
        await sock.sendMessage(from, { 
            text: `📖 *${randomBook.name} ${randomChapter.number}*\n\n🎙️ *Papá dice:*\n${respuestaTransformada}` 
        }, { quoted: msg });
        
    } catch (err) {
        console.error("Error en handleBibliaCommand:", err);
        await sock.sendMessage(from, { text: "El papu yisus esta ocupado" }, { quoted: msg });
    }
}

async function ejecutarPeaky(sock, msg, content, from) {
    try {
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        // La ruta a tu archivo local
        const url = `file://${path.join(__dirname, 'peaky', 'index.html')}?texto=${encodeURIComponent(content.slice(6))}`;
        
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        // Establecemos el viewport exactamente a 720x429
        await page.setViewport({ width: 720, height: 429 });
        
        // Capturamos el área completa sin deformar (recorte 1:1)
        const screenshot = await page.screenshot({ 
            clip: { x: 0, y: 0, width: 720, height: 429 } 
        });
        
        await browser.close();
        await sock.sendMessage(from, { image: screenshot }, { quoted: msg });
    } catch (e) { 
        console.error("Error en Peaky:", e);
        await sock.sendMessage(from, { text: "Es de caballeros cometer errores 🚬." }); 
    }
}

async function ejecutarDbz(sock, msg, content, from) {
    try {
        // Obtenemos el texto limpio eliminando el comando !dbz
        const texto = content.replace(/^dbz/i, "").trim();

        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        // Ajuste de ruta: apunta a bot/dbz/index.html
        const url = `file://${path.join(__dirname, 'dbz', 'index.html')}?texto=${encodeURIComponent(texto)}`;
        
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        // Dimensiones específicas para DBZ: 853x480
        await page.setViewport({ width: 853, height: 480 });
        
        const screenshot = await page.screenshot({ 
            clip: { x: 0, y: 0, width: 853, height: 480 } 
        });
        
        await browser.close();
        await sock.sendMessage(from, { image: screenshot }, { quoted: msg });
    } catch (e) { 
        console.error("Error en DBZ:", e);
        await sock.sendMessage(from, { text: "Padre Ball murio" }); 
    }
}

async function ejecutarHomero(sock, msg, content, from) {
    try {
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        // La ruta a tu archivo local
        const url = `file://${path.join(__dirname, 'homero', 'index.html')}?texto=${encodeURIComponent(content.slice(7))}`;
        
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        // Establecemos el viewport exactamente a 720x429
        await page.setViewport({ width: 720, height: 429 });
        
        // Capturamos el área completa sin deformar (recorte 1:1)
        const screenshot = await page.screenshot({ 
            clip: { x: 0, y: 0, width: 720, height: 429 } 
        });
        
        await browser.close();
        await sock.sendMessage(from, { image: screenshot }, { quoted: msg });
    } catch (e) { 
        console.error("Error en Peaky:", e);
        await sock.sendMessage(from, { text: "Dou" }); 
    }
}


const FormData = require('form-data');


async function handleCaraCommand(sock, msg, from) {
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        if (!fs.existsSync('./cara.png')) {
            throw new Error("No existe cara.png");
        }
        const sourceBuffer = fs.readFileSync('./cara.png');

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: 'cara.png' });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': '55381c98cfmsh394c624aa1f6f9dp1c7d23jsn45453572f377',
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        // Envía la imagen directamente sin mensajes de texto
        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(e);
        // Solo envía mensaje si ocurre un error[cite: 1]
        await sock.sendMessage(from, { text: "Saxoul es muy pesado xdxdxdxd." });
    }
}

async function handleCaraCommand2(sock, msg, from) {
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        if (!fs.existsSync('./cara1.png')) {
            throw new Error("No existe cara1.png");
        }
        const sourceBuffer = fs.readFileSync('./cara1.png');

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: 'cara1.png' });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': '918cf6be1emshd476e5b23809898p165ba8jsn2c6ff829a7a0',
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        // Envía la imagen directamente sin mensajes de texto
        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(e);
        // Solo envía mensaje si ocurre un error[cite: 1]
        await sock.sendMessage(from, { text: "Andrey whigga." });
    }
}

async function handleCaraCommand3(sock, msg, from) {
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        if (!fs.existsSync('./cara2.png')) {
            throw new Error("No existe cara2.png");
        }
        const sourceBuffer = fs.readFileSync('./cara2.png');

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: 'cara2.png' });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': 'e0bcf449c7msh273bb19f6dc25c2p185ff9jsne0fdb7f6c4dd',
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        // Envía la imagen directamente sin mensajes de texto
        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(e);
        // Solo envía mensaje si ocurre un error[cite: 1]
        await sock.sendMessage(from, { text: "Se lo balearon xdxdxxxd." });
    }
}

async function handleCaraCommand4(sock, msg, from) {
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        if (!fs.existsSync('./cara3.png')) {
            throw new Error("No existe cara2.png");
        }
        const sourceBuffer = fs.readFileSync('./cara3.png');

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: 'cara3.png' });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': '688a2c57b2msh47bbf6504ba3c34p128784jsneb0b2787cd4a',
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        // Envía la imagen directamente sin mensajes de texto
        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(e);
        // Solo envía mensaje si ocurre un error[cite: 1]
        await sock.sendMessage(from, { text: "hastamañana deje dormir chao" });
    }
}

async function handleCaraCommand5(sock, msg, from) {
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        if (!fs.existsSync('./cara4.png')) {
            throw new Error("No existe cara2.png");
        }
        const sourceBuffer = fs.readFileSync('./cara4.png');

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: 'cara4.png' });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': 'b553ae262emshe6c02493ba1b5c2p1a5786jsnba9f6123bc0c',
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        // Envía la imagen directamente sin mensajes de texto
        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(e);
        // Solo envía mensaje si ocurre un error[cite: 1]
        await sock.sendMessage(from, { text: "Esto apenas comienza. Fue una batalla, pero ganaremos la guerra" });
    }
}

async function handleCaraCommand6(sock, msg, from) {
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        if (!fs.existsSync('./cara6.png')) {
            throw new Error("No existe cara2.png");
        }
        const sourceBuffer = fs.readFileSync('./cara6.png');

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: 'cara6.png' });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': '81b8430e7amshb3291a3d7e339a2p1b3436jsnebbdff042aea',
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        // Envía la imagen directamente sin mensajes de texto
        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(e);
        // Solo envía mensaje si ocurre un error[cite: 1]
        await sock.sendMessage(from, { text: "Tremendo fracasado cffffffffffffffffffffffffffffff" });
    }
}

async function handleCaraCommand7(sock, msg, from) {
    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        if (!fs.existsSync('./cara7.png')) {
            throw new Error("No existe cara2.png");
        }
        const sourceBuffer = fs.readFileSync('./cara7.png');

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: 'cara7.png' });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': '385b02c520mshcbcb08b15b1e47dp14be5fjsn65ca328cc8ba',
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        // Envía la imagen directamente sin mensajes de texto
        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(e);
        // Solo envía mensaje si ocurre un error[cite: 1]
        await sock.sendMessage(from, { text: "Estoy en una situación: si hablo la embarro, si no hablo también la embarro... y cuando voy a cagar, no cago" });
    }
}

async function startBot() {
    cargarBaneos(); 
    const processedMessages = new Set();
    
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

            const senderId = msg.key.participant || msg.key.remoteJid;
            const from = msg.key.remoteJid;
            const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
            const comando = msgText.trim().split(/ +/)[0].toLowerCase();

            // 1. COMPROBACIÓN DE BANEO CON LOG
            if (listaBaneados.includes(senderId)) {
                console.log(`[BANEADO] Intento bloqueado: ${senderId} | Comando: ${comando}`);
                return;
            }

            if (processedMessages.has(msg.key.id)) return;
            processedMessages.add(msg.key.id);
            setTimeout(() => processedMessages.delete(msg.key.id), 5000);
            
            console.log("DEBUG: Comando detectado ->", comando);

            // 2. Ejecución de comandos
            // Lógica unificada para extraer ID (mención o respuesta)
            const getTarget = () => {
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                return contextInfo?.mentionedJid?.[0] || contextInfo?.participant;
            };

            if (comando === "ban") {
                const userToBan = getTarget();
                if (!userToBan) return await sock.sendMessage(from, { text: "Menciona al papu o responde su mensaje" });
                await sock.sendMessage(from, { text: banUser(userToBan, senderId) });
            } 
            else if (comando === "unban") {
                const userToUnban = getTarget();
                if (!userToUnban) return await sock.sendMessage(from, { text: "Menciona al papu o responde su mensaje" });
                await sock.sendMessage(from, { text: unbanUser(userToUnban, senderId) });
            }
            else if (comando === "sticker") await ejecutarSticker(sock, msg, from);
            else if (comando === "nota") await ejecutarNota(sock, msg, msgText, from);
            else if (comando === "peaky") await ejecutarPeaky(sock, msg, msgText, from);
            else if (comando === "dbz") await ejecutarDbz(sock, msg, msgText, from);
            else if (comando === "homero") await ejecutarHomero(sock, msg, msgText, from);
            else if (comando === "cum") await cum(sock, msg, msgText, from);
            else if (comando === "ship") await ejecutarShip(sock, msg, from);
            else if (comando === "bana") await ejecutarBana(sock, msg, msgText, from);
            else if (comando === "r34") await handleR34Command(sock, msg, msgText, from);
            else if (comando === "globo") await handleGloboCommand(sock, msg, from);
            else if (comando === "cheems") await handleCheemsCommand(sock, msg, from);
            else if (comando === "papubiblia") await handleBibliaCommand(sock, msg, from);
            else if (comando === "saxoulealo") await handleCaraCommand(sock, msg, from);
            else if (comando === "andreyficalo") await handleCaraCommand2(sock, msg, from);
            else if (comando === "kirkificalo") await handleCaraCommand3(sock, msg, from);
            else if (comando === "edimficalo") await handleCaraCommand4(sock, msg, from);
            else if (comando === "polopolealo") await handleCaraCommand5(sock, msg, from);
            else if (comando === "cavifaxealo") await handleCaraCommand6(sock, msg, from);
            else if (comando === "altafullealo") await handleCaraCommand7(sock, msg, from);
            else await ejecutarIA(sock, msg, msgText, from);
        });
    } catch (e) {
        console.error("❌ Error en startBot:", e);
    }
}

startBot();