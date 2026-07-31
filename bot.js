// ==================== DEPENDENCIAS Y CONFIGURACIÓN ====================
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const puppeteer = require('puppeteer');
const { GoogleGenerativeAI } = require('@google/generative-ai');


const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    downloadContentFromMessage,
    downloadMediaMessage 
} = require('@whiskeysockets/baileys');

ffmpeg.setFfmpegPath(ffmpegPath);

// ==================== VARIABLES Y CONSTANTES ====================
const ADMINS = ["20499878940793@s.whatsapp.net"];
const BANS_FILE = './bans.json';
let listaBaneados = [];

// ==================== IMPORTACIÓN DE MÓDULOS DE COMANDOS ====================
const { ejecutarShip } = require('./commands/ship');
const { handleCheemsCommand } = require('./commands/cheems');
const { ejecutarBana } = require('./commands/bana');
const { ejecutarSticker } = require('./commands/sticker');
const { ejecutarNota } = require('./commands/nota');
const { ejecutarIA } = require('./commands/ia');
const { handleBibliaCommand } = require('./commands/biblia');
const { cum } = require('./commands/cum');
const { handleR34Command } = require('./commands/r34');
const { handleGloboCommand } = require('./commands/globo');
const { ejecutarPeaky } = require('./commands/peaky');
const { ejecutarDbz } = require('./commands/dbz');
const { ejecutarHomero } = require('./commands/homero');
const { ejecutarQueseso } = require('./commands/queseso');
const { ejecutarMonofoto } = require('./commands/monofoto');
const { esAdmin, cargarBaneos, banUser, unbanUser, getListaBaneados } = require('./commands/bans');
const { ejecutarEdit } = require('./commands/edit');
const { conectarDB } = require('./database');

const { 
    handleCaraCommand, 
    handleCaraCommand2, 
    handleCaraCommand3, 
    handleCaraCommand4, 
    handleCaraCommand5, 
    handleCaraCommand6, 
    handleCaraCommand7,
    handleCaraCommand8,
    handleCaraCommand9
} = require('./commands/caras');

const handleCrash = (err, type) => {
    console.error(`\n❌ ERROR CRÍTICO (${type}):`, err);
    console.log("\n[PAUSE] Presiona ENTER para cerrar...");
    try { fs.readSync(0, Buffer.alloc(1), 0, 1); } catch(e) {}
    process.exit(1);
};
process.on('uncaughtException', (err) => handleCrash(err, 'Uncaught Exception'));
process.on('unhandledRejection', (reason) => handleCrash(reason, 'Unhandled Rejection'));



async function startBot() {
    // Conectar a MongoDB Atlas al iniciar
    await conectarDB();
    await cargarBaneos(); 

    const processedMessages = new Set();
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState("auth_info");
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({ 
            version, 
            auth: state, 
            printQRInTerminal: false, 
            browser: ["TapIAs Bot", "Chrome", "120.0.0"],
            syncFullHistory: false,
            logger: require("pino")({ level: "silent" })
        }); 

        sock.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) qrcode.generate(qr, { small: true });
            if (connection === "open") console.log("✅ BOT CONECTADO");
            if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        });
        
        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type !== 'notify') return;
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const senderId = msg.key.participant || msg.key.remoteJid;
            const from = msg.key.remoteJid;
            const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
            const comando = msgText.trim().split(/ +/)[0].toLowerCase();

            // 1. COMPROBACIÓN DE BANEO BLINDADA (Con await integrado)
            const listaBaneadosActual = await getListaBaneados();
            const numeroSender = senderId.split('@')[0];
            
            const estaBaneado = listaBaneadosActual.some(bannedId => {
                const idBandid = typeof bannedId === 'string' ? bannedId : (bannedId.userId || '');
                return idBandid.split('@')[0] === numeroSender;
            });

            if (estaBaneado) {
                console.log(`[BANEADO] Intento bloqueado: ${senderId} | Comando: ${comando}`);
                return;
            }

            if (processedMessages.has(msg.key.id)) return;
            processedMessages.add(msg.key.id);
            setTimeout(() => processedMessages.delete(msg.key.id), 5000);
            
            console.log("DEBUG: Comando detectado ->", comando);

            // 2. Ejecución de comandos
            const getTarget = () => {
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                return contextInfo?.mentionedJid?.[0] || contextInfo?.participant;
            };

            switch (comando) {
                case "ban": {
                    const userToBan = getTarget();
                    if (!userToBan) {
                        await sock.sendMessage(from, { text: "Menciona al papu o responde su mensaje" });
                        break;
                    }
                    const resultadoBan = await banUser(userToBan, senderId);
                    await sock.sendMessage(from, { text: resultadoBan });
                    break;
                }
                case "unban": {
                    const userToUnban = getTarget();
                    if (!userToUnban) {
                        await sock.sendMessage(from, { text: "Menciona al papu o responde su mensaje" });
                        break;
                    }
                    const resultadoUnban = await unbanUser(userToUnban, senderId);
                    await sock.sendMessage(from, { text: resultadoUnban });
                    break;
                }
                case "edit":
                    await ejecutarEdit(sock, msg, msgText, from);
                    break;
                case "sticker":
                    await ejecutarSticker(sock, msg, from);
                    break;
                case "queseso": // <-- COMANDO AÑADIDO AQUÍ
                    await ejecutarQueseso(sock, msg, from);
                    break;
                case "foto":
                    await ejecutarMonofoto(sock, msg, from);
                    break;
                case "nota":
                    await ejecutarNota(sock, msg, msgText, from);
                    break;
                case "peaky":
                    await ejecutarPeaky(sock, msg, msgText, from);
                    break;
                case "dbz":
                    await ejecutarDbz(sock, msg, msgText, from);
                    break;
                case "homero":
                    await ejecutarHomero(sock, msg, msgText, from);
                    break;
                case "cum":
                    await cum(sock, msg, msgText, from);
                    break;
                case "ship":
                    await ejecutarShip(sock, msg, from);
                    break;
                case "bana":
                    await ejecutarBana(sock, msg, msgText, from);
                    break;
                case "r34":
                    await handleR34Command(sock, msg, msgText, from);
                    break;
                case "globo":
                    await handleGloboCommand(sock, msg, from);
                    break;
                case "cheems":
                    await handleCheemsCommand(sock, msg, from);
                    break;
                case "papubiblia":
                    await handleBibliaCommand(sock, msg, from);
                    break;
                case "saxoulealo":
                    await handleCaraCommand(sock, msg, from);
                    break;
                case "andreyficalo":
                    await handleCaraCommand2(sock, msg, from);
                    break;
                case "kirkificalo":
                    await handleCaraCommand3(sock, msg, from);
                    break;
                case "edimficalo":
                    await handleCaraCommand4(sock, msg, from);
                    break;
                case "polopolealo":
                    await handleCaraCommand5(sock, msg, from);
                    break;
                case "cavifaxealo":
                    await handleCaraCommand6(sock, msg, from);
                    break;
                case "altafullealo":
                    await handleCaraCommand7(sock, msg, from);
                    break;
                case "gushificacion":
                    await handleCaraCommand8(sock, msg, from);
                    break;
                case "downficalo":
                    await handleCaraCommand9(sock, msg, from);
                    break;
                default:
                    await ejecutarIA(sock, msg, msgText, from);
                    break;
            }
        });
    } catch (e) {
        console.error("❌ Error en startBot:", e);
    }
}
startBot();