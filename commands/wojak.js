// commands/wojak.js
const { HfInference } = require('@huggingface/inference');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs'); // Necesario para guardar temporalmente la imagen
const path = require('path');

// Inicializamos con tu token quemado
const hf = new HfInference("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");

async function ejecutarWojak(sock, msg, msgText, from) {
    // --- DETECCIÓN DE IMAGEN ---
    // Verificamos si el mensaje es una imagen o si responde a una imagen
    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = msg.message?.imageMessage;
    const isQuotedImage = quotedMessage?.imageMessage;

    let mediaMessage = null;

    if (isImage) {
        mediaMessage = msg;
    } else if (isQuotedImage) {
        // Simulamos un objeto msg para la imagen citada
        mediaMessage = {
            message: {
                imageMessage: quotedMessage.imageMessage
            }
        };
    } else {
        await sock.sendMessage(from, { text: "Responde a una imagen papu" });
        return;
    }

    try {
        await sock.sendMessage(from, { text: "Analizando tu jetatura y convirtiendo a Wojak... 🎨" });

        // 1. Descargamos la imagen recibida
        const buffer = await downloadMediaMessage(
            mediaMessage,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        // 2. Convertimos el buffer a base64 para enviarlo a Hugging Face
        // El formato debe ser "data:image/jpeg;base64,..."
        const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // 3. Definimos el prompt para el modo strict
        const strictPrompt = "Make them into a wojak, mspaint style, wojak meme face,ms paint drawing style, blank white background";

        // 4. Usamos el endpoint de generación de imagen (Img2Img automáticamente si pones inputs)
        const response = await hf.imageGeneration({
            model: 'clayshoaf/Make-Wojak-2511',
            inputs: base64Image, // Usamos la imagen en base64 como input
            parameters: {
                prompt: strictPrompt, // El prompt de estilo
                negative_prompt: "photorealistic, high quality, detailed, shading, smooth lines, color gradient, bad quality, ugly, distorted"
                // strength: 0.8 // Opcional: Ajusta qué tanto cambia la cara original (por defecto suele ser alto)
            }
        });

        // 5. Procesamos la respuesta y la enviamos
        const arrayBuffer = await response.arrayBuffer();
        const outputBuffer = Buffer.from(arrayBuffer);

        await sock.sendMessage(from, {
            image: outputBuffer,
            caption: "¡Te quedó igualito, papu! 🗿"
        });

    } catch (error) {
        console.error("❌ Error con Hugging Face Img2Img:", error);
        await sock.sendMessage(from, { text: "Hubo un error al procesar la imagen, papu. Asegúrate de que sea una imagen válida." });
    }
}

module.exports = { ejecutarWojak };