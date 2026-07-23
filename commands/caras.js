// commands/caras.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuraciones de cada comando (apiKey, nombre del archivo, mensaje de error)
const carasConfig = {
    1: { file: 'cara.png', key: '55381c98cfmsh394c624aa1f6f9dp1c7d23jsn45453572f377', error: "Saxoul es muy pesado xdxdxdxd." },
    2: { file: 'cara1.png', key: '918cf6be1emshd476e5b23809898p165ba8jsn2c6ff829a7a0', error: "Andrey whigga." },
    3: { file: 'cara2.png', key: 'e0bcf449c7msh273bb19f6dc25c2p185ff9jsne0fdb7f6c4dd', error: "Se lo balearon xdxdxxxd." },
    4: { file: 'cara3.png', key: '688a2c57b2msh47bbf6504ba3c34p128784jsneb0b2787cd4a', error: "hastamañana deje dormir chao" },
    5: { file: 'cara4.png', key: 'b553ae262emshe6c02493ba1b5c2p1a5786jsnba9f6123bc0c', error: "Esto apenas comienza. Fue una batalla, pero ganaremos la guerra" },
    6: { file: 'cara6.png', key: '81b8430e7amshb3291a3d7e339a2p1b3436jsnebbdff042aea', error: "Tremendo fracasado cfffffffffffffffffffffffffffff" },
    7: { file: 'cara7.png', key: '385b02c520mshcbcb08b15b1e47dp14be5fjsn65ca328cc8ba', error: "Estoy en una situación: si hablo la embarro, si no hablo también la embarro... y cuando voy a cagar, no cago" },
    8: { file: 'cara8.png', key: 'ebb9ad3797msh2abcff81c13d704p1e7e09jsndb92f682e085', error: "Fallo" },
    9: { file: 'cara9.png', key: '22b504acb8msh1b21b9dc076f1b4p127180jsncbce2752cfd0', error: "*Babeaa*" }
};

async function handleCaraMaster(sock, msg, from, numeroCara) {
    const config = carasConfig[numeroCara];
    if (!config) return;

    const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    const isDirectImage = msg.message?.imageMessage;

    if (!isQuotedImage && !isDirectImage) return;

    try {
        const targetBuffer = await downloadMediaMessage(isDirectImage ? msg : { message: { imageMessage: isQuotedImage } }, 'buffer');

        // Ruta corregida a assets/Caras/
        const sourcePath = path.join(__dirname, '..', 'assets', 'Caras', config.file);
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`No existe ${config.file} en assets/Caras/`);
        }
        const sourceBuffer = fs.readFileSync(sourcePath);

        const form = new FormData();
        form.append('source_image', sourceBuffer, { filename: config.file });
        form.append('target_image', targetBuffer, { filename: 'target.jpg' });

        const response = await axios.post('https://deepfake-face-swap-ai.p.rapidapi.com/swap-face', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': config.key,
                'x-rapidapi-host': 'deepfake-face-swap-ai.p.rapidapi.com'
            }
        });

        await sock.sendMessage(from, { image: { url: response.data.image_url } });

    } catch (e) {
        console.error(`Error en cara ${numeroCara}:`, e);
        await sock.sendMessage(from, { text: config.error });
    }
}

// Funciones individuales optimizadas que llaman a la central
async function handleCaraCommand(sock, msg, from) { await handleCaraMaster(sock, msg, from, 1); }
async function handleCaraCommand2(sock, msg, from) { await handleCaraMaster(sock, msg, from, 2); }
async function handleCaraCommand3(sock, msg, from) { await handleCaraMaster(sock, msg, from, 3); }
async function handleCaraCommand4(sock, msg, from) { await handleCaraMaster(sock, msg, from, 4); }
async function handleCaraCommand5(sock, msg, from) { await handleCaraMaster(sock, msg, from, 5); }
async function handleCaraCommand6(sock, msg, from) { await handleCaraMaster(sock, msg, from, 6); }
async function handleCaraCommand7(sock, msg, from) { await handleCaraMaster(sock, msg, from, 7); }
async function handleCaraCommand8(sock, msg, from) { await handleCaraMaster(sock, msg, from, 8); }
async function handleCaraCommand9(sock, msg, from) { await handleCaraMaster(sock, msg, from, 9); }

module.exports = {
    handleCaraCommand,
    handleCaraCommand2,
    handleCaraCommand3,
    handleCaraCommand4,
    handleCaraCommand5,
    handleCaraCommand6,
    handleCaraCommand7,
    handleCaraCommand8,
    handleCaraCommand9

};