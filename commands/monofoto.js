const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function ejecutarMonofoto(sock, msg, from) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        return await sock.sendMessage(from, { text: "¡Responde a una imagen para aplicar el efecto papu!" });
    }

    const messageType = Object.keys(quoted)[0];
    if (messageType !== 'imageMessage') {
        return await sock.sendMessage(from, { text: "¡Responde a una imagen para aplicar el efecto papu!." });
    }

    try {
        const downloadTarget = { key: msg.key, message: quoted };
        const bufferImage = await downloadMediaMessage(downloadTarget, "buffer", {}, { logger: undefined, reconnect: true });

        const id = msg.key.id;
        const dirAssets = path.join(__dirname, '../assets/foto');
        
        if (!fs.existsSync(dirAssets)) {
            return await sock.sendMessage(from, { text: "Error pappu" });
        }

        const pathImgI = path.join(dirAssets, `input_img_${id}.png`);
        const pathBgF = path.join(dirAssets, 'fondo.png');
        const pathVidR = path.join(dirAssets, 'monofoto.mp4');
        const pathGifG = path.join(dirAssets, 'monofoto.gif');
        const pathOutput = path.join(dirAssets, `output_${id}.mp4`);

        if (!fs.existsSync(pathBgF) || !fs.existsSync(pathVidR) || !fs.existsSync(pathGifG)) {
            return await sock.sendMessage(from, { text: "Error pappu." });
        }

        fs.writeFileSync(pathImgI, bufferImage);

        await new Promise((res, rej) => {
            ffmpeg()
                .input(pathVidR) // [0] r: monofoto.mp4 (1x1 para el audio)
                .input(pathBgF)  // [1] f: fondo.png (500x500)
                .input(pathImgI) // [2] i: imagen del usuario (escalada a 500x500)
                .input(pathGifG) // [3] g: monofoto.gif con transparencia (escalado a 500x500)
                .complexFilter([
                    "[0:v]scale=1:1[vid]",
                    "[1:v]scale=500:500[fondo]",
                    "[2:v]scale=500:500[img]",
                    "[3:v]scale=500:500[gif]",
                    // Orden estricto del script original:
                    // 1. Overlay sobre f (fondo) + r (video 1x1)
                    "[fondo][vid]overlay=0:0[tmp1]",
                    // 2. Overlay sobre el resultado anterior + i (imagen del usuario 500x500)
                    "[tmp1][img]overlay=0:0[tmp2]",
                    // 3. Overlay final sobre el resultado anterior + g (gif transparente 500x500)
                    "[tmp2][gif]overlay=0:0[out]"
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
        console.error("Error en monofoto:", e);
        await sock.sendMessage(from, { text: "Hubo un error al procesar el video." });
    }
}

module.exports = { ejecutarMonofoto };