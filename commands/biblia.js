// commands/biblia.js
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstructionBiblia = "Eres un padre amoroso que explica pasajes de la Biblia a su hijo de forma sencilla, cálida y comprensible.";

async function handleBibliaCommand(sock, msg, from) {
    const API_KEY = '7hQJSMS2IIWfJCSZKk2bs';
    const BIBLE_ID = '826f63861180e056-01';
    
    try {
        const { data: booksData } = await axios.get(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books`, {
            headers: { 'api-key': API_KEY }
        });

        const books = booksData.data;
        const randomBook = books[Math.floor(Math.random() * books.length)];
        
        const { data: chaptersData } = await axios.get(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/books/${randomBook.id}/chapters`, {
            headers: { 'api-key': API_KEY }
        });

        const chapters = chaptersData.data.filter(c => c.number !== 'intro');
        const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];

        const { data: verseData } = await axios.get(`https://api.scripture.api.bible/v1/bibles/${BIBLE_ID}/chapters/${randomChapter.id}?content-type=text`, {
            headers: { 'api-key': API_KEY }
        });

        const textoCrudo = verseData.data.content.replace(/<[^>]*>?/gm, '').trim();

        const prompt = `Como un padre amoroso contándole un cuento a su hijo, explica este pasaje de forma sencilla: "${textoCrudo}"`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: { systemInstruction: systemInstructionBiblia }
        });

        const respuestaTransformada = response.text;

        await sock.sendMessage(from, { 
            text: `📖 *${randomBook.name} ${randomChapter.number}*\n\n🎙️ *Papá dice:*\n${respuestaTransformada}` 
        }, { quoted: msg });
        
    } catch (err) {
        console.error("Error en handleBibliaCommand:", err);
        await sock.sendMessage(from, { text: "El papu yisus esta ocupado" }, { quoted: msg });
    }
}

module.exports = { handleBibliaCommand };