// commands/aiNormal.js
const { GoogleGenAI } = require('@google/genai');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6IgEyGhHZHOv23_w1daGXYSgQlb22WiHzPOm3DuDjg_tA" });

const systemInstructionMeloso = "Eres un asistente virtual increíblemente tierno Responde a todo con cariño.";

async function ejecutarAiNormal(sock, msg, msgText, from) {
    try {
        await sock.sendPresenceUpdate('composing', from);

        // Extraer el texto limpio quitando el comando (-gpt o -ia)
        const args = msgText.trim().split(/ +/);
        args.shift(); 
        const textoComando = args.join(" ") || "Hola, mi amor";

        // Detectar si hay mensajes citados (respuestas a otros mensajes)
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Verificar si lo citado es una imagen o texto
        const isImage = msg.message?.imageMessage || quotedMessage?.imageMessage;
        const isQuotedText = quotedMessage?.conversation || quotedMessage?.extendedTextMessage?.text;

        let contents = [];

        if (isImage) {
            // Caso 2: Si responde a una imagen (o manda una con texto)
            const targetMessage = msg.message?.imageMessage ? msg : {
                message: quotedMessage,
                key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId }
            };

            const stream = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
                logger: require("pino")({ level: "silent" }),
                reuploadRequest: sock.updateMediaMessage
            });

            const imageBase64 = stream.toString("base64");

            contents = [
                `usuario mando esta imagen ${textoComando}`,
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: "image/jpeg"
                    }
                }
            ];

        } else if (isQuotedText) {
            // Caso 1: Si responde a otro mensaje de texto
            const textoCitado = isQuotedText;
            contents = [
                `usuario dijo esto: (${textoCitado}) ${textoComando}`
            ];

        } else {
            // Caso 3: Si se envía un mensaje normal a secas
            contents = [textoComando];
        }

        // Generar respuesta con la IA
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: contents,
            config: { 
                systemInstruction: systemInstructionMeloso 
            }
        });

        await sock.sendMessage(from, { text: response.text }, { quoted: msg });

    } catch (error) {
        console.error("Error en aiNormal:", error);
        await sock.sendMessage(from, { text: "Ocurrio un error unu " }, { quoted: msg });
    }
}

module.exports = { ejecutarAiNormal };