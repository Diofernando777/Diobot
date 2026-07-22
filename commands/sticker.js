const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

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
            const input = path.join(__dirname, `../input_${id}.mp4`);
            const output = path.join(__dirname, `../output_${id}.webp`);
            
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
                        "-q:v 50" // <-- CALIDAD AJUSTABLE
                    ])
                    .toFormat("webp")
                    .save(output)
                    .on("end", res)
                    .on("error", rej);
            });

            await sock.sendMessage(from, { sticker: fs.readFileSync(output) });
            
            // Limpieza
            if (fs.existsSync(input)) fs.unlinkSync(input);
            if (fs.existsSync(output)) fs.unlinkSync(output);
        }
    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: "Falló la conversión épicamente" });
    }
}

module.exports = { ejecutarSticker };