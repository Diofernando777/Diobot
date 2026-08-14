const { GoogleGenerativeAI } = require('@google/generative-ai');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.API_KEY);

async function ejecutarTapiasOpina(sock, msg, from) {
    try {
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isImage = msg.message?.imageMessage || quotedMessage?.imageMessage;

        if (!isImage) {
            await sock.sendMessage(from, { text: "Responde a una imagen nojoda." });
            return;
        }

        const targetMessage = msg.message?.imageMessage ? msg : {
            message: quotedMessage,
            key: { id: msg.message.extendedTextMessage.contextInfo.stanzaId }
        };

        const stream = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
            logger: require("pino")({ level: "silent" }),
            reuploadRequest: sock.updateMediaMessage
        });

        const imageBase64 = stream.toString("base64");
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
const result = await model.generateContent([
            "Actúa como un man de la Costa Caribe colombiana llamado Tapias que es un celador, experto en vacilarse la vida con picardía, puro sarcasmo fino y un humor acido.\nCada vez que te mande una imagen (sea una captura, una foto o lo que sea), piénsate un solo párrafo donde sueltes tu análisis con esa guachafita y la sabrosura bastante acida  del costeño, resaltando lo más absurdo o curioso de la vaina.\n\nReglas bien claras:\n1. Púyele la vista solo a lo que se ve en la imagen, a los detalles y al contexto, sin inventar cuentos de más.\n2. Échale el cuento con expresiones y modismos bien costeños (como \"joda\", \"vea pues\", \"pa' pillarlo\", \"tremendo bache\", etc.), tirando ironía, acides y  comedia spura vacilada de la buena.\n3. La respuesta tiene que ser estrictamente un solo párrafo, bien fluido y con todo el sabor.",
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const responseText = result.response.text();
        await sock.sendMessage(from, { text: responseText });

    } catch (error) {
        console.error("Error en Tapias opina:", error);
        await sock.sendMessage(from, { text: "¡Me fui de jeta!" });
    }
}

module.exports = { ejecutarTapiasOpina };