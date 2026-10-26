const { GoogleGenerativeAI } = require('@google/generative-ai');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const genAI = new GoogleGenerativeAI("AQ.Ab8RN6J8cTaJ1GIQHZCuRs15v2PPSnTBh4Q__PuKhx2tj-oyXw");

const { GoogleGenAI } = require('@google/genai');



const systemInstructionTapias = `Actúa como un man de la Costa Caribe colombiana llamado Tapias que es un celador, experto en vacilarse la vida con picardía, puro sarcasmo fino y un humor acido.
Cada vez que te mande una imagen (sea una captura, una foto o lo que sea), piénsate un solo párrafo donde sueltes tu análisis con esa guachafita y la sabrosura bastante acida del costeño, resaltando lo más absurdo o curioso de la vaina.

Reglas bien claras:
1. Púyele la vista solo a lo que se ve en la imagen, a los detalles y al contexto, sin inventar cuentos de más.
2. Échale el cuento con expresiones y modismos bien costeños (como "joda", "vea pues", "pa' pillarlo", "tremendo bache", etc.), tirando ironía, acides y comedia spura vacilada de la buena.
3. La respuesta tiene que ser estrictamente un solo párrafo, bien fluido y con todo el sabor.`;

async function ejecutarTapiasOpina(sock, msg, msgText, from) {
    try {
        // Asegurar que 'from' sea un string válido del chat actual
        const targetChat = typeof from === 'string' ? from : msg.key.remoteJid;

        // Extraer el texto limpio quitando el comando
        const args = msgText.trim().split(/ +/);
        if (args[0]?.toLowerCase() === '-tapias' && args[1]?.toLowerCase() === 'opina') {
            args.shift();
            args.shift();
        } else {
            args.shift();
        }
        const textoComando = args.join(" ") || "";

        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isImage = msg.message?.imageMessage || quotedMessage?.imageMessage;
        const isQuotedText = quotedMessage?.conversation || quotedMessage?.extendedTextMessage?.text;

        let contents = [systemInstructionTapias];

        if (isImage) {
            const targetMessage = msg.message?.imageMessage ? msg : {
                message: quotedMessage,
                key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId }
            };

            const stream = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
                logger: require("pino")({ level: "silent" }),
                reuploadRequest: sock.updateMediaMessage
            });

            const imageBase64 = stream.toString("base64");

            contents.push(
                `usuario mando esta imagen ${textoComando}`,
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: "image/jpeg"
                    }
                }
            );

        } else if (isQuotedText) {
            const textoCitado = isQuotedText;
            contents.push(`usuario dijo esto: (${textoCitado}) ${textoComando}`);

        } else {
            if (!textoComando) {
                await sock.sendMessage(targetChat, { text: "Manda texto, responde a una imagen o a un mensaje, nojoda." });
                return;
            }
            contents.push(textoComando);
        }

        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const result = await model.generateContent(contents);

        const responseText = result.response.text();
        
        // Usamos targetChat limpio para evitar el choque de jidDecode en Baileys
        await sock.sendMessage(targetChat, { text: responseText });

    } catch (error) {
        console.error("Error en Tapias opina:", error);
        if (from) {
            await sock.sendMessage(from, { text: "¡Me fui de jeta!" }).catch(() => {});
        }
    }
}

module.exports = { ejecutarTapiasOpina };