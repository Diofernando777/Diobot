// commands/globo.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

async function handleGloboCommand(sock, msg, from) {
    const id = msg.key.id;
    const tempDir = path.join(__dirname, "..", "temp"); // Ajustado para apuntar a la raíz del proyecto
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const msgType = msg.message.imageMessage || msg.message.videoMessage || quoted?.imageMessage || quoted?.videoMessage;
    
    if (!msgType) return await sock.sendMessage(from, { text: "Responde a una imagen, video o GIF." });

    const isVideo = msgType.mimetype.includes("video") || msgType.mimetype.includes("gif");
    const inputPath = path.join(tempDir, `in_${id}${isVideo ? ".mp4" : ".png"}`);
    const outputPath = path.join(tempDir, `out_${id}${isVideo ? ".mp4" : ".png"}`);
    
    // Ruta corregida a la carpeta assets desde commands/
    const globoPath = path.join(__dirname, "..", "assets", "globo.png");

    const cleanup = () => {
        [inputPath, outputPath].forEach(file => { if (fs.existsSync(file)) fs.unlinkSync(file); });
    };

    try {
        const stream = await downloadContentFromMessage(msgType, isVideo ? "video" : "image");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        fs.writeFileSync(inputPath, buffer);

        if (!fs.existsSync(globoPath)) {
            cleanup();
            return await sock.sendMessage(from, { text: "❌ Falta el archivo 'assets/globo.png'." });
        }

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

module.exports = { handleGloboCommand };