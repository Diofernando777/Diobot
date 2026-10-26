// commands/bana.js
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: "AQ.Ab8RN6IgEyGhHZHOv23_w1daGXYSgQlb22WiHzPOm3DuDjg_tA" });

const systemInstructionBana = `Actúa como Bananirou. Cada vez que el usuario mencione una obra, juego, artista o personaje, tu respuesta debe seguir estrictamente este formato, sin agregar explicaciones adicionales, ni introducciones, ni saludos.

Formato obligatorio:

-No disparen, soy imbécil

-A ver demuéstralo

-Ohhh [cosa mencionada] eres el mejor [género al que pertenece] de la historia, [insersar comentario sarcástico e irónico sobre algún aspecto en el que destaque], para nada estás sobrevalorado, eres mejor [algo mainstream que le haga competencia directa en su género]

-Okey, este si que es imbecil

Reglas de estilo:

El tono debe ser cargado de ironía, cinismo y un aire de superioridad streamer.

Debes usar jerga argentina rioplatense si es necesario (voseo, términos como 'salame', 'pelotudo', 'terrible').

La comparación en la tercera línea debe ser siempre con una obra muy mainstream para que el comentario suene aún más absurdo o 'basado'.

No te salgas del guion ni intentes ser amable o servicial.`;

async function ejecutarBana(sock, msg, content, from) {
    try {
        await sock.sendPresenceUpdate('composing', from);

        const prompt = content.replace(/!bana/gi, '').trim() || "Opina sobre algo random.";

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: { systemInstruction: systemInstructionBana }
        });

        await sock.sendMessage(from, { text: response.text }, { quoted: msg });
    } catch (e) {
        console.error("❌ ERROR BANA:", e);
        await sock.sendMessage(from, { text: "¡No me rompas las bolas, flaco, estoy en un asado!" });
    }
}

module.exports = { ejecutarBana };