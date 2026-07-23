// commands/edit.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// 1. Definimos las 10 APIs de RapidAPI apuntando al endpoint correcto '/swap-face'
const apisFaceSwap = [
    {
        name: "API 1",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/swap-face",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 2",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/swap-face",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "2176e169f8msh78736e45075f47fp13741cjsna415521a3fe0"
    },
    {
        name: "API 3",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/swap-face",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "22730348e8mshe141c348f799ec6p144d46jsn68b915cae8a3"
    },
    {
        name: "API 4",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/swap-face",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "b309444edbmsh4198148652de4a4p1457d0jsn7866ca1d316b"
    },
    {
        name: "API 6",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/swap-face",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "fa9fa60fecmsh822ae39565c5982p1d9c10jsnb5bf1b5ba7f5"
    }
];

async function ejecutarEdit(sock, msg, msgText, from) {
    console.log("----------------------------------------");
    console.log(" [EDIT] Comando recibido. Analizando mensaje...");

    const textoLimpio = msgText ? msgText.trim().toLowerCase() : "";
    if (textoLimpio !== "edit") {
        console.log(" [EDIT] ❌ El caption no es exactamente 'edit' o viene vacío. Omitiendo ejecución.");
        return;
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo;
    const quotedMessage = contextInfo?.quotedMessage;

    const isImage = !!msg.message?.imageMessage;
    const quotedImageMessage = 
        quotedMessage?.imageMessage || 
        quotedMessage?.viewOnceMessage?.message?.imageMessage ||
        quotedMessage?.ephemeralMessage?.message?.imageMessage;

    const isQuotedImage = !!quotedImageMessage;

    if (!isImage || !isQuotedImage) {
        console.log(" [EDIT] ❌ Faltan imágenes (se requiere responder a una foto con otra foto y el comando 'edit').");
        return;
    }

    try {
        console.log(" [EDIT] Descargando imagen 2 (Cara donante)...");
        const donorBuffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        console.log(" [EDIT] Descargando imagen 1 (Imagen base objetivo)...");
        const targetMessage = {
            message: {
                imageMessage: quotedImageMessage
            }
        };
        const targetBuffer = await downloadMediaMessage(
            targetMessage,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        if (!donorBuffer || !targetBuffer) {
            console.log(" [EDIT] ❌ Error al descargar alguna de las dos imágenes.");
            return;
        }

        console.log(` [EDIT] Imágenes descargadas con éxito. Base: ${targetBuffer.length} bytes | Donante: ${donorBuffer.length} bytes.`);

        // SELECCIÓN ALEATORIA DE API
        const randomIndex = Math.floor(Math.random() * apisFaceSwap.length);
        const apiElegida = apisFaceSwap[randomIndex]; 
        console.log(` [EDIT] Usando ${apiElegida.name} (${apiElegida.endpoint})...`);

        const formData = new FormData();
        formData.append('target_image', new Blob([targetBuffer]), 'target.jpg');
        formData.append('source_image', new Blob([donorBuffer]), 'donor.jpg');

        const response = await fetch(apiElegida.endpoint, {
            method: 'POST',
            headers: {
                'X-RapidAPI-Key': apiElegida.key,
                'X-RapidAPI-Host': apiElegida.host
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(` [EDIT] ❌ Error en ${apiElegida.name}:`, errText);
            return;
        }

        const data = await response.json();

        if (!data.image_url) {
            console.error(" [EDIT] ❌ La API no devolvió una image_url válida:", data);
            return;
        }

        console.log(` [EDIT] ✅ Imagen generada con éxito usando ${apiElegida.name} en URL: ${data.image_url}`);

        // Envía únicamente la imagen limpia sin caption
        await sock.sendMessage(from, {
            image: { url: data.image_url }
        });

        console.log(" [EDIT] ✅ Imagen procesada y enviada a WhatsApp con éxito.");

    } catch (error) {
        console.error(" [EDIT] ❌ ERROR CRÍTICO EN EDIT:", error);
    }
    console.log("----------------------------------------");
}

module.exports = { ejecutarEdit, apisFaceSwap };