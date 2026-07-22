// commands/bans.js
const fs = require('fs');
const path = require('path');

const ADMINS = [
    "20499878940793@s.whatsapp.net",
    "234836212109486@lid",
    "61856404246529@lid",
    "158170878111744@lid", // <--- Nuevo admin agregado
    "1451900322016@lid"     // <--- Nuevo admin agregado
];
// Sube un nivel desde 'commands' para encontrar bans.json en la raíz
const BANS_FILE = path.join(__dirname, '../bans.json');

function leerBansDisco() {
    try {
        if (fs.existsSync(BANS_FILE)) {
            const data = fs.readFileSync(BANS_FILE, 'utf8');
            return !data.trim() ? [] : JSON.parse(data);
        }
        fs.writeFileSync(BANS_FILE, JSON.stringify([], null, 2));
        return [];
    } catch (e) {
        console.warn("⚠️ bans.json corrupto, reiniciando lista...");
        fs.writeFileSync(BANS_FILE, JSON.stringify([], null, 2));
        return [];
    }
}

function guardarBansDisco(lista) {
    fs.writeFileSync(BANS_FILE, JSON.stringify(lista, null, 2));
}

function esAdmin(userId) {
    if (!userId) return false;
    const numero = userId.split('@')[0];
    return ADMINS.some(admin => admin.startsWith(numero));
}

function cargarBaneos() {
    const lista = leerBansDisco();
    console.log(`[BANS] Lista cargada desde la raíz. Total: ${lista.length}`);
    return lista;
}

function banUser(userId, senderId) {
    if (!esAdmin(senderId)) {
        console.log(`[SEGURIDAD] Intento de ban no autorizado por: ${senderId}`);
        return "Que crees que haces papu :v.";
    }

    // Validación para evitar que un admin banee a otro admin
    if (esAdmin(userId)) {
        return "No puedes banear a otro admin papu.";
    }

    let lista = leerBansDisco();

    if (!lista.includes(userId)) {
        lista.push(userId);
        guardarBansDisco(lista);
        console.log(`[BANS] Usuario baneado y guardado en raíz: ${userId}`);
        return "Adios popo xdxdxdxdxd.";
    }
    return "Ese compa ya esta muerto xdxdxxdxdxdxd.";
}

function unbanUser(userId, senderId) {
    if (!esAdmin(senderId)) {
        return "Que crees que haces papu :v.";
    }

    let lista = leerBansDisco();

    if (!lista.includes(userId)) {
        return "Ese papu esta en papulandia";
    }

    lista = lista.filter(id => id !== userId);
    guardarBansDisco(lista);
    
    console.log(`[BANS] Usuario desbaneado en raíz: ${userId}`);
    return "Despierta papu";
}

function getListaBaneados() {
    return leerBansDisco();
}

module.exports = {
    esAdmin,
    cargarBaneos,
    banUser,
    unbanUser,
    getListaBaneados
};