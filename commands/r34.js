// commands/r34.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function handleR34Command(sock, msg, msgText, from) {
    const API_KEY = "5a1faf4cff57900725489c3574871b40899219725b467ed2059b19caf6771c9bf23726a7785b026835ecb39413a6ce9d884f1e8804dde67bd52ae646459ff554";
    const USER_ID = "6475331";
    const listaShadowBan = ["loli", "shota", "child", "toddler", "ai_generated", "furry"];
    const listaVergonzosa = ["umamusume"];

    let rawText = msgText.replace(/r34/i, "").trim();
    const esVideo = /\bvideo\b/i.test(rawText);
    let cleanText = rawText.replace(/\bvideo\b/gi, "").trim();

    let tagsArray = cleanText.split(',').map(t => t.trim().replace(/\s+/g, '_').toLowerCase()).filter(t => t.length > 0);

    if (tagsArray.some(t => listaVergonzosa.includes(t))) {
        console.log(`[R34] Bloqueo vergonzoso: ${tagsArray}`);
        const imgPath = path.join(__dirname, '..', 'assets', 'no.png'); // Ajustado a assets si aplica, o déjalo en './no.png' si está en la raíz
        if (fs.existsSync(imgPath)) return await sock.sendMessage(from, { image: fs.readFileSync(imgPath) });
        return await sock.sendMessage(from, { text: "No quieres ver eso." });
    }

    const baseQuery = tagsArray.join('+');
    const finalQuery = `${baseQuery}`.trim(); 

    let posts = [];
    for (let i = 0; i < 3; i++) {
        try {
            const page = Math.floor(Math.random() * 20);
            const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(finalQuery)}&limit=50&pid=${page}&user_id=${USER_ID}&api_key=${API_KEY}`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            if (res.data && res.data.length > 0) {
                posts = res.data;
                break;
            }
        } catch (e) { console.log(`[R34] Intento ${i + 1} fallido.`); }
    }

    if (posts.length === 0) return await sock.sendMessage(from, { text: "No se encontraron resultados." });

    console.log(`[R34] API recibidos: ${posts.length}`);

    let filtrados = [];
    let descartados = 0;

    posts.forEach(p => {
        const tagsPost = p.tags ? p.tags.split(" ") : [];
        const tieneShadowBan = listaShadowBan.some(t => tagsPost.includes(t));
        const esTipoCorrecto = esVideo ? (p.file_url && p.file_url.match(/\.(mp4|webm)$/i)) : true;

        if (!tieneShadowBan && esTipoCorrecto) {
            filtrados.push(p);
        } else {
            descartados++;
            if (tieneShadowBan) {
                console.log(`[R34] Descartado por ShadowBan. Tags: ${p.tags}`);
            }
        }
    });

    console.log(`[R34] Filtrado final: ${filtrados.length} válidos, ${descartados} descartados.`);

    if (filtrados.length === 0) return await sock.sendMessage(from, { text: "No se encontraron resultados." });

    const randomPost = filtrados[Math.floor(Math.random() * filtrados.length)];
    const options = randomPost.file_url.match(/\.(mp4|webm)$/i) ? { video: { url: randomPost.file_url } } : { image: { url: randomPost.file_url } };
    
    await sock.sendMessage(from, options);
}

module.exports = { handleR34Command };