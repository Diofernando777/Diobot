const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

function escribirLog(texto) {
    console.log(texto);
}

async function ejecutarSticker(sock, msg, from) {
    escribirLog("=== NUEVA EJECUCIÓN DE STICKER ===");

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        escribirLog("❌ Error: No se encontró mensaje citado.");
        return await sock.sendMessage(from, { text: "Responde a una imagen, video o GIF, papu :v" });
    }

    let actualMessage = quoted;
    let wrapperType = "Normal";

    if (quoted.viewOnceMessage?.message) {
        actualMessage = quoted.viewOnceMessage.message;
        wrapperType = "ViewOnceMessage";
    } else if (quoted.viewOnceMessageV2?.message) {
        actualMessage = quoted.viewOnceMessageV2.message;
        wrapperType = "ViewOnceMessageV2";
    } else if (quoted.viewOnceMessageV2Extension?.message) {
        actualMessage = quoted.viewOnceMessageV2Extension.message;
        wrapperType = "ViewOnceMessageV2Extension";
    } else if (quoted.ephemeralMessage?.message) {
        actualMessage = quoted.ephemeralMessage.message;
        wrapperType = "EphemeralMessage";
    }

    escribirLog(`Contenedor detectado: ${wrapperType}`);
    
    const messageType = Object.keys(actualMessage)[0];
    const mediaMessage = actualMessage[messageType];
    escribirLog(`Tipo de contenido interno: ${messageType}`);

    const isVideoOrGif = messageType === 'videoMessage' || mediaMessage?.mimetype?.startsWith('video') || mediaMessage?.gifPlayback;
    const isImage = messageType === 'imageMessage' || mediaMessage?.mimetype?.startsWith('image');

    if (!isImage && !isVideoOrGif) {
        escribirLog("❌ Error: El contenido no es imagen, video o GIF.");
        return await sock.sendMessage(from, { text: "Eso no es una imagen, video o GIF válido, papu." });
    }

    try {
        escribirLog("Iniciando descarga del multimedia con Baileys...");
        const downloadTarget = {
            key: msg.key,
            message: actualMessage
        };

        const buffer = await downloadMediaMessage(downloadTarget, "buffer", {}, {
            logger: undefined,
            reconnect: true
        });
        
        escribirLog(`Multimedia descargado con éxito. Tamaño: ${buffer.length} bytes`);

        if (isImage) {
            escribirLog("Procesando imagen con Sharp...");
            const stickerBuffer = await sharp(buffer)
                .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 80 })
                .toBuffer();
            
            escribirLog("Imagen convertida correctamente. Enviando...");
            await sock.sendMessage(from, { sticker: stickerBuffer });

        } else if (isVideoOrGif) {
            const id = msg.key.id;
            const input = path.join(__dirname, `../input_${id}.mp4`);
            const output = path.join(__dirname, `../output_${id}.webp`);
            
            fs.writeFileSync(input, buffer);
            escribirLog(`Archivo temporal guardado en: ${input}`);
            escribirLog("Iniciando proceso con FFmpeg...");

            await new Promise((res, rej) => {
                ffmpeg(input)
                    .inputOptions([
                        "-ss 0",
                        "-t 5"
                    ])
                    .outputOptions([
                        "-vcodec libwebp",
                        "-pix_fmt yuva420p",
                        "-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0,format=yuva420p,fps=12",
                        "-loop 0",
                        "-an",
                        "-vsync 0",
                        "-preset default",
                        "-compression_level 6",
                        "-q:v 28"
                    ])
                    .toFormat("webp")
                    .on("start", (cmdLine) => {
                        escribirLog(`[FFmpeg Comando]: ${cmdLine}`);
                    })
                    .on("stderr", (stderr) => {
                        escribirLog(`[FFmpeg Log]: ${stderr}`);
                    })
                    .save(output)
                    .on("end", () => {
                        escribirLog("FFmpeg finalizó la conversión correctamente.");
                        res();
                    })
                    .on("error", (err) => {
                        escribirLog(`❌ [FFmpeg Error]: ${err.message}`);
                        rej(err);
                    });
            });

            const stats = fs.statSync(output);
            escribirLog(`Tamaño final del archivo WebP: ${stats.size} bytes`);

            escribirLog("Enviando sticker animado a WhatsApp...");
            await sock.sendMessage(from, { sticker: fs.readFileSync(output) });
            
            escribirLog("Limpiando archivos temporales...");
            if (fs.existsSync(input)) fs.unlinkSync(input);
            if (fs.existsSync(output)) fs.unlinkSync(output);
            escribirLog("=== PROCESO COMPLETADO CON ÉXITO ===");
        }
    } catch (e) {
        escribirLog(`❌ [ERROR CRÍTICO]: ${e.stack || e.message}`);
        await sock.sendMessage(from, { text: "Falló la conversión del sticker, papu." });
    }
}

module.exports = { ejecutarSticker };