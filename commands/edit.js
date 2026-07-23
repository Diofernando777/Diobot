// commands/edit.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// 1. Definimos las 10 APIs de RapidAPI (con los campos vacíos listos para rellenar)
const apisFaceSwap = [
    {
        name: "API 1",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_1",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 2",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_2",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 3",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_3",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 4",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_4",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 5",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_5",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 6",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_6",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 7",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_7",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 8",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_8",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 9",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_9",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    },
    {
        name: "API 10",
        endpoint: "https://deepfake-face-swap-ai.p.rapidapi.com/TU_ENDPOINT_10",
        host: "deepfake-face-swap-ai.p.rapidapi.com",
        key: "3a442997f1msh2479cae6875ebedp12f669jsncdfd4cbfa649"
    }
];

async function ejecutarEdit(sock, msg, msgText, from) {
    console.log("----------------------------------------");
    console.log(" [EDIT] Comando recibido. Analizando mensaje...");

    // Validamos que el texto sea exactamente "edit" (si viene vacío o con otra cosa, no hace nada)
    const textoLimpio = msgText ? msgText.trim().toLowerCase() : "";
    if (textoLimpio !== "edit") {
        console.log(" [EDIT] ❌ El caption no es exactamente 'edit' o viene vacío. Omitiendo ejecución.");
        return;
    }

    // --- DETECCIÓN DE IMÁGENES (RESPUESTA A IMAGEN) ---
    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = msg.message?.imageMessage;
    const isQuotedImage = quotedMessage?.imageMessage;

    if (!isImage || !isQuotedImage) {
        console.log(" [EDIT] ❌ Faltan imágenes (se requiere responder a una foto con otra foto y el comando 'edit').");
        await sock.sendMessage(from, { text: "Debes enviar una foto con el texto `edit` respondiendo a otra foto, papu." });
        return;
    }

    try {
        await sock.sendMessage(from, { text: "Procesando intercambio de rostros... 🔄" });

        // Imagen 2 (Cara donante): La imagen que manda el usuario con el texto "edit"
        console.log(" [EDIT] Descargando imagen 2 (Cara donante)...");
        const donorBuffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
        );

        // Imagen 1 (Imagen base a la que se le pondrá la cara): La imagen a la que se está respondiendo
        console.log(" [EDIT] Descargando imagen 1 (Imagen base objetivo)...");
        const targetMessage = {
            message: {
                imageMessage: quotedMessage.imageMessage
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
            await sock.sendMessage(from, { text: "Epico error papu." });
            return;
        }

        console.log(` [EDIT] Imágenes descargadas con éxito. Base: ${targetBuffer.length} bytes | Donante: ${donorBuffer.length} bytes.`);

        // ⚠️ EJEMPLO DE USO CON LA API 1 (puedes cambiar el índice [0] al 9 según la API que quieras usar)
        const apiElegida = apisFaceSwap[0]; 
        console.log(` [EDIT] Usando ${apiElegida.name} (${apiElegida.endpoint})...`);

        // Aquí configuras el cuerpo de la petición (FormData o JSON según la API de RapidAPI que elijas)
        const formData = new FormData();
        formData.append('target_image', new Blob([targetBuffer]), 'target.jpg');
        formData.append('swap_image', new Blob([donorBuffer]), 'swap.jpg');

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
            await sock.sendMessage(from, { text: `Error en la papu api.` });
            return;
        }

        // Procesamos la respuesta (dependiendo si la API devuelve JSON con URL o directamente un buffer binario)
        const resultBuffer = Buffer.from(await response.arrayBuffer());

        await sock.sendMessage(from, {
            image: resultBuffer,
            caption: "¡Face swap completado, papu! 🗿"
        });

        console.log(" [EDIT] ✅ Imagen procesada y enviada con éxito.");

    } catch (error) {
        console.error(" [EDIT] ❌ ERROR CRÍTICO EN EDIT:", error);
        await sock.sendMessage(from, { text: "Hubo un error papu." });
    }
    console.log("----------------------------------------");
}

module.exports = { ejecutarEdit, apisFaceSwap };