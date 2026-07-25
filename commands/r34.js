// commands/r34.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function handleR34Command(sock, msg, msgText, from) {
    const API_KEY = "5a1faf4cff57900725489c3574871b40899219725b467ed2059b19caf6771c9bf23726a7785b026835ecb39413a6ce9d884f1e8804dde67bd52ae646459ff554";
    const USER_ID = "6475331";
    const listaVergonzosa = ["umamusume","loli", "shota"];

    console.log(`\n================ [R34 COMMAND TRIGGERED] ================`);
    console.log(`[R34 Debug] Mensaje recibido del usuario: "${msgText}"`);

    let rawText = msgText.replace(/r34/i, "").trim();
    rawText = rawText.replace(/^[^a-zA-Z0-9]+/, "").trim();

    const esVideo = /\bvideo\b/i.test(rawText);
    console.log(`[R34 Debug] ¿Filtro de video activo?: ${esVideo}`);

    let cleanText = rawText.replace(/\bvideo\b/gi, "").trim();

    let tagsCrudos = cleanText.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
    console.log(`[R34 Debug] Tags crudos separados por comas:`, tagsCrudos);

    if (tagsCrudos.length === 0) {
        console.log(`[R34 Debug] Error: No se ingresaron tags.`);
        return await sock.sendMessage(from, { text: "Se te olvido poner el texto para buscar pornito :v`" });
    }

    let tagsProcesados = tagsCrudos.map(tag => tag.replace(/\s+/g, '_'));
    console.log(`[R34 Debug] Tags procesados:`, tagsProcesados);

    const tagPrincipal = tagsProcesados[0];
    const tagsSecundarios = tagsProcesados.slice(1);

    console.log(`[R34 Debug] 🔍 Tag limpio para consultar la API: "${tagPrincipal}"`);
    console.log(`[R34 Debug] 🔍 Tags secundarios para aplicar localmente:`, tagsSecundarios);

    await ejecutarBusquedaInteligente(sock, tagPrincipal, tagsSecundarios, esVideo, from, API_KEY, USER_ID, listaVergonzosa);
}

async function ejecutarBusquedaInteligente(sock, tagPrincipal, tagsSecundarios, esVideo, from, API_KEY, USER_ID, listaVergonzosa) {
    // Si el usuario escribió algo de la lista vergonzosa, enviamos el no.png
    if (tagPrincipal.split('+').some(t => listaVergonzosa.includes(t)) || tagsSecundarios.some(t => listaVergonzosa.includes(t))) {
        console.log(`[R34 Security] 🛑 ¡Bloqueo vergonzoso activado por entrada de texto! Enviando no.png`);
        return await enviarNoPng(sock, from);
    }

    let posts = [];
    try {
        const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagPrincipal)}&limit=100&pid=0&user_id=${USER_ID}&api_key=${API_KEY}`;
        console.log(`[R34 API] Realizando petición HTTP principal a Rule34 con tag: "${tagPrincipal}"...`);
        
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
        if (res.data && res.data.length > 0) {
            posts = res.data;
            console.log(`[R34 API] ¡Éxito! Posts totales devueltos por la API: ${posts.length}`);
        } else {
            console.log(`[R34 API] La API respondió pero el array de posts está vacío ([]).`);
        }
    } catch (e) {
        console.log(`[R34 API Error] Error crítico en la petición: ${e.message}`);
    }

    if (posts.length === 0) {
        console.log(`[R34 Result] Búsqueda fallida: No hay resultados para "${tagPrincipal}".`);
        return await sock.sendMessage(from, { text: `No se encontro porno chido de eso .` });
    }

    let filtrados = [];
    posts.forEach((p, index) => {
        const tagsPostString = p.tags ? p.tags.toLowerCase() : "";
        const tagsPostArray = tagsPostString.split(" ");

        const esTipoCorrecto = esVideo ? (p.file_url && p.file_url.match(/\.(mp4|webm)$/i)) : true;
        const cumpleSecundarios = tagsSecundarios.every(tagSec => tagsPostArray.includes(tagSec));
        const tieneVerguenza = listaVergonzosa.some(tagVergonzoso => tagsPostArray.includes(tagVergonzoso));

        if (esTipoCorrecto && cumpleSecundarios && !tieneVerguenza) {
            filtrados.push(p);
        } else if (tieneVerguenza) {
            console.log(`[R34 Security Filter] Post #${index} (ID ${p.id}) descartado por contener tags vergonzosos.`);
        }
    });

    console.log(`[R34 Filter] Posts válidos tras aplicar filtros locales y de seguridad: ${filtrados.length} de ${posts.length}`);

    if (filtrados.length === 0) {
        console.log(`[R34 Result] Ningún post pasó los filtros secundarios o de seguridad.`);
        return await sock.sendMessage(from, { text: `No se encontro porno chido de eso .` });
    }

    const randomIndex = Math.floor(Math.random() * filtrados.length);
    const randomPost = filtrados[randomIndex];
    console.log(`[R34 Selection] Post elegido aleatoriamente (Índice ${randomIndex} de ${filtrados.length}): ID ${randomPost.id}`);
    console.log(`[R34 Selection] URL del archivo multimedia: ${randomPost.file_url}`);

    const options = randomPost.file_url.match(/\.(mp4|webm)$/i) ? { video: { url: randomPost.file_url } } : { image: { url: randomPost.file_url } };
    
    await sock.sendMessage(from, options);
    console.log(`[R34 Send] ¡Mensaje enviado con éxito a ${from}!\n=========================================================`);
}

async function enviarNoPng(sock, from) {
    const imgPath = path.join(__dirname, '..', 'assets', 'no.png');
    if (fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: fs.readFileSync(imgPath) });
    } else {
        console.log(`[R34 Error] No se encontró el archivo no.png en la ruta: ${imgPath}`);
    }
}

module.exports = { handleR34Command };