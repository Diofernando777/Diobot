const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function ejecutarQueseso(sock, msg, from) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        return await sock.sendMessage(from, { text: "¡Responde a una imagen para aplicar el efecto, papu!" });
    }

    const messageType = Object.keys(quoted)[0];
    if (messageType !== 'imageMessage') {
        return await sock.sendMessage(from, { text: "¡Responde a una imagen para aplicar el efecto, papu!." });
    }

    try {
        const downloadTarget = { key: msg.key, message: quoted };
        const bufferImage = await downloadMediaMessage(downloadTarget, "buffer", {}, { logger: undefined, reconnect: true });

        const id = msg.key.id;
        const dirAssets = path.join(__dirname, '../assets/queseso');
        
        if (!fs.existsSync(dirAssets)) {
            return await sock.sendMessage(from, { text: "Error pappu" });
        }

        const pathImgI = path.join(dirAssets, `input_img_${id}.png`);
        const pathVidR = path.join(dirAssets, 'que.mp4');
        const pathGifG = path.join(dirAssets, 'qeseso.gif');
        const pathOutput = path.join(dirAssets, `output_${id}.mp4`);

        if (!fs.existsSync(pathVidR) || !fs.existsSync(pathGifG)) {
            return await sock.sendMessage(from, { text: "Error papu." });
        }

        fs.writeFileSync(pathImgI, bufferImage);

        await new Promise((res, rej) => {
            ffmpeg()
                .input(pathVidR) // [0] r: que.mp4 (video 1x1 para el audio)
                .input(pathImgI) // [1] i: imagen del usuario (360x640)
                .input(pathGifG) // [2] g: qeseso.gif transparente (360x640)
                .complexFilter([
                    "[0:v]scale=1:1[vid]",
                    "[1:v]scale=360:640[img]",
                    "[2:v]scale=360:640[gif]",
                    // Orden de capas: Imagen de fondo (360x640), encima el video (1x1) y arriba el GIF (360x640)
                    "[img][vid]overlay=0:0[tmp]",
                    "[tmp][gif]overlay=0:0[out]"
                ])
                .outputOptions([
                    "-map [out]",
                    "-map 0:a?",
                    "-c:v libx264",
                    "-pix_fmt yuv420p",
                    "-c:a aac",
                    "-shortest"
                ])
                .save(pathOutput)
                .on("end", res)
                .on("error", rej);
        });

        await sock.sendMessage(from, { 
            video: fs.readFileSync(pathOutput)
        });

        if (fs.existsSync(pathImgI)) fs.unlinkSync(pathImgI);
        if (fs.existsSync(pathOutput)) fs.unlinkSync(pathOutput);

    } catch (e) {
        console.error("Error en queseso:", e);
        await sock.sendMessage(from, { text: "Error papu." });
    }
}

module.exports = { ejecutarQueseso };