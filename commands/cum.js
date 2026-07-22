// commands/cum.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

async function cum(sock, msg, messageContent, from) {
    const m = msg.message;
    const isImage = m.imageMessage || m.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isVideo = m.videoMessage || m.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
    const media = isImage || isVideo;

    if (!media) {
        await sock.sendMessage(from, { text: "Responde a una imagen o texto para cumearlo 7w7." });
        return;
    }

    try {
        const tipo = isImage ? 'image' : 'video';
        const stream = await downloadContentFromMessage(media, tipo);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        // Ruta corregida a la carpeta assets dentro de tu proyecto (subiendo un nivel desde commands)
        const rutaPng = path.join(__dirname, '..', 'assets', 'coso.png');
        if (!fs.existsSync(rutaPng)) {
            await sock.sendMessage(from, { text: "No hay mas cum poe hoy unu'." });
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

module.exports = { cum };