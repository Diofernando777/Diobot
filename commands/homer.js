const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function ejecutarHomerScript(sock, msg, from) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isDirectImage = msg.message?.imageMessage;
    const isQuotedImage = quoted?.imageMessage;

    if (!isDirectImage && !isQuotedImage) {
        return await sock.sendMessage(from, { text: "¡Responde a una imagen o envía una con el comando, papu!" });
    }

    try {
        const dirAssets = path.join(__dirname, '../assets/homero');
        
        const pathJpgBase = path.join(dirAssets, 'homero.jpg');
        const pathMp4Ref = path.join(dirAssets, 'homero.mp4');
        const pathGifOverlay = path.join(dirAssets, 'Homero.gif');

        if (!fs.existsSync(pathJpgBase) || !fs.existsSync(pathMp4Ref) || !fs.existsSync(pathGifOverlay)) {
            return await sock.sendMessage(from, { text: "Error: Faltan archivos base en la carpeta assets/homero, papu." });
        }

        const targetObject = isDirectImage ? msg : { message: { imageMessage: isQuotedImage } };
        const bufferUserImg = await downloadMediaMessage(targetObject, "buffer", {}, { logger: undefined, reconnect: true });

        const id = msg.key.id;
        const pathUserImg = path.join(dirAssets, `user_${id}.png`);
        const pathOutput = path.join(dirAssets, `output_${id}.mp4`);

        fs.writeFileSync(pathUserImg, bufferUserImg);

        await new Promise((res, rej) => {
            let command = ffmpeg()
                .input(pathJpgBase)     
                .input(pathMp4Ref)      
                .input(pathUserImg)     
                .input(pathGifOverlay); 

            command.complexFilter([
                // Cambiado de 144:81 a 144:80 para que la altura sea par
                "[0:v]scale=144:80,setsar=1[base]",
                "[1:v]scale=1:1,setsar=1[vid]",
                "[2:v]scale=60:80:force_original_aspect_ratio=decrease,pad=144:80:(ow-iw)/2:(oh-ih)/2,setsar=1[user_centered]",
                "[3:v]scale=144:80,setsar=1[gif]",
                "[base][user_centered]overlay=0:0[tmp1]",
                "[tmp1][vid]overlay=0:0[tmp2]",
                "[tmp2][gif]overlay=0:0[out]"
            ]);

            command.outputOptions([
                "-map [out]",
                "-map 1:a?",
                "-c:v libx264",
                "-pix_fmt yuv420p",
                "-c:a aac",
                "-shortest"
            ]);

            command.save(pathOutput)
               .on("end", () => res())
               .on("error", (err, stdout, stderr) => {
                   console.error("--- ERROR DE FFMPEG DETECTADO ---");
                   const pathErrorLog = path.join(__dirname, '../error_ffmpeg.txt');
                   const errorContenido = `Fecha: ${new Date().toISOString()}\nMensaje: ${err.message}\n\nSTDERR:\n${stderr}`;
                   fs.writeFileSync(pathErrorLog, errorContenido);
                   console.log("El error detallado se ha guardado en 'error_ffmpeg.txt'");
                   rej(err);
               });
        });

        await sock.sendMessage(from, { 
            video: fs.readFileSync(pathOutput)
        });

        if (fs.existsSync(pathUserImg)) fs.unlinkSync(pathUserImg);
        if (fs.existsSync(pathOutput)) fs.unlinkSync(pathOutput);

    } catch (e) {
        console.error("Error en el script de Homero:", e);
        await sock.sendMessage(from, { text: "Ocurrió un error al procesar el video, papu." });
    }
}

module.exports = { ejecutarHomerScript };