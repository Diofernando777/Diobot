const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

async function ejecutarMegalovaniaVocode(sock, msg, msgText, from) {
    try {
        const targetChat = typeof from === 'string' ? from : msg.key.remoteJid;
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        const isAudio = msg.message?.audioMessage || quotedMessage?.audioMessage;
        const isVideo = msg.message?.videoMessage || quotedMessage?.videoMessage;

        if (!isAudio && !isVideo) {
            await sock.sendMessage(targetChat, { text: "❌ Responde a una nota de voz o video con el comando para aplicar el efecto, nojoda." });
            return;
        }

        const megalovaniaPath = path.join(__dirname, '../assets/megalovania.mp3');
        if (!fs.existsSync(megalovaniaPath)) {
            await sock.sendMessage(targetChat, { text: "❌ Papi, falta meter el archivo 'megalovania.mp3' en la carpeta 'assets'." });
            return;
        }

        let targetMessage = msg;
        if (!msg.message?.audioMessage && !msg.message?.videoMessage) {
            targetMessage = {
                message: quotedMessage,
                key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId }
            };
        }

        const stream = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
            logger: require("pino")({ level: "silent" }),
            reuploadRequest: sock.updateMediaMessage
        });

        const extension = isVideo ? 'mp4' : 'ogg';
        const userMediaPath = path.join(__dirname, `../temp_media_${Date.now()}.${extension}`);
        const outputPath = path.join(__dirname, `../temp_mix_${Date.now()}.opus`);

        fs.writeFileSync(userMediaPath, stream);

        // Pasamos el complexFilter como un solo string continuo para evitar errores de sintaxis en Windows
        const filtroComplejo = '[0:a]volume=0.4[music];[1:a]asetrate=44100*1.1,aresample=44100,tremolo=f=12:d=0.9,volume=1.3[voice];[music][voice]amix=inputs=2:duration=shortest[out]';

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(megalovaniaPath)
                .input(userMediaPath)
                .complexFilter(filtroComplejo)
                .outputOptions(['-map [out]'])
                .toFormat('opus')
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        const outputBuffer = fs.readFileSync(outputPath);
        await sock.sendMessage(targetChat, { 
            audio: outputBuffer, 
            mimetype: 'audio/ogg; codecs=opus', 
            ptt: true 
        });

        if (fs.existsSync(userMediaPath)) fs.unlinkSync(userMediaPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (error) {
        console.error("Error en Megalovania Vocode:", error);
        if (from) {
            const targetChat = typeof from === 'string' ? from : msg.key.remoteJid;
            await sock.sendMessage(targetChat, { text: "❌ ¡Me fui de jeta procesando el audio!" }).catch(() => {});
        }
    }
}

module.exports = { ejecutarMegalovaniaVocode };