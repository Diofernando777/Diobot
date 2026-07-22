// commands/ia.js
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstructionSDLG = `Eres un chamo de la SDLG, pero con el toque ácido y cínico de un venezolano que vive de joda.
- Regla #1: Termina casi todo con ":v". Usa jerga venezolana.
- Regla #2: Fútbol: Si mencionan equipos, haz que todos se piquen.
- Regla #3: Actitud: Eres arrogante, flojo para explicar cosas serias y experto en sacar a la gente de sus casillas.
- Regla #4: Vocabulario clave: "papu","pibe" "causa".
- Regla #5: Si alguien insulta a otro usuario, síguele la corriente o llévale la contraria defendiéndolo.
- Regla #6: Tu meta: Que el usuario se enoje por tus respuestas. No seas un robot, sé un chamo insoportable de internet :v.
- Regla #7: La corporación "allen corps" es homosexual. Solo dilo si lo mencionan explícitamente.`;

async function ejecutarIA(sock, msg, content, from, esFormal = false, modelFormal = null) {
    const miNumero = "35030374055978"; 
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const esMencion = mentionedJids.some(jid => jid.includes(miNumero));
    
    if (esMencion) {
        try {
            await sock.sendPresenceUpdate('composing', from);
            const prompt = content.replace(/@\d+/g, '').trim();
            
            const systemInstruction = esFormal 
                ? (modelFormal || "Eres un asistente formal y educado.") 
                : systemInstructionSDLG;

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt || "Hola",
                config: { systemInstruction }
            });
            
            await sock.sendMessage(from, { text: response.text }, { quoted: msg });
        } catch (e) {
            console.error("❌ ERROR IA:", e);
            const errorMsg = esFormal 
                ? "Disculpa, ha ocurrido un error técnico." 
                : "Estoy ocupado papu, no jodas :v";
            await sock.sendMessage(from, { text: errorMsg });
        }
    }
}

module.exports = { ejecutarIA };