// commands/bans.js
const fs = require('fs');
const path = require('path');
const { Admin, Ban } = require('../database');

// Rutas de los archivos locales en la raíz
const ADMINS_FILE = path.join(__dirname, '../admins.json');
const BANS_FILE = path.join(__dirname, '../bans.json');

// Funciones auxiliares para manejo local de archivos
function leerJsonLocal(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return !data.trim() ? [] : JSON.parse(data);
        }
        return [];
    } catch (e) {
        return [];
    }
}

function guardarJsonLocal(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`⚠️ Error al escribir en el archivo local ${filePath}:`, e);
    }
}

async function esAdmin(userId) {
    if (!userId) return false;
    const numero = userId.split('@')[0];

    try {
        // Intenta consultar MongoDB y actualizar respaldo local
        const adminsEnDB = await Admin.find({});
        if (adminsEnDB && adminsEnDB.length > 0) {
            guardarJsonLocal(ADMINS_FILE, adminsEnDB);
            return adminsEnDB.some(admin => admin.userId.startsWith(numero) || admin.userId === userId);
        }
    } catch (e) {
        console.warn("⚠️ MongoDB no disponible para admins. Leyendo admins.json local...");
    }

    // Respaldo local si falla MongoDB o no retorna datos
    const adminsLocales = leerJsonLocal(ADMINS_FILE);
    return adminsLocales.some(admin => {
        const idAdmin = admin.userId || admin;
        return idAdmin.startsWith(numero) || idAdmin === userId;
    });
}

async function cargarBaneos() {
    try {
        const listaBansDB = await Ban.find({});
        if (listaBansDB) {
            guardarJsonLocal(BANS_FILE, listaBansDB);
            console.log(`[BANS] Lista cargada desde MongoDB. Total: ${listaBansDB.length}`);
            return listaBansDB.map(b => b.userId || b);
        }
    } catch (e) {
        console.warn("⚠️ MongoDB no disponible para bans. Leyendo bans.json local...");
    }

    // Respaldo local
    const listaLocal = leerJsonLocal(BANS_FILE);
    console.log(`[BANS] Lista cargada desde respaldo local. Total: ${listaLocal.length}`);
    return listaLocal.map(b => b.userId || b);
}

async function banUser(userId, senderId) {
    if (!(await esAdmin(senderId))) {
        console.log(`[SEGURIDAD] Intento de ban no autorizado por: ${senderId}`);
        return "Que crees que haces papu :v.";
    }

    if (await esAdmin(userId)) {
        return "No puedes banear a otro admin papu.";
    }

    try {
        // Guardar en MongoDB Atlas
        await Ban.findOneAndUpdate(
            { userId },
            { $set: { baneado: true } },
            { upsert: true, new: true }
        );

        // Actualizar respaldo local de inmediato
        const listaActualizada = await Ban.find({});
        guardarJsonLocal(BANS_FILE, listaActualizada);

        console.log(`[BANS] Usuario baneado en MongoDB y respaldo local: ${userId}`);
        return "Adios popo xdxdxdxdxd.";
    } catch (e) {
        console.error("Error al banear en base de datos, intentando modo local:", e);
        
        // Fallback local si falla la base de datos al escribir
        let listaLocal = leerJsonLocal(BANS_FILE);
        const formateados = listaLocal.map(b => b.userId || b);
        
        if (!formateados.includes(userId)) {
            listaLocal.push({ userId, baneado: true });
            guardarJsonLocal(BANS_FILE, listaLocal);
            return "Adios popo xdxdxdxdxd. (Guardado local)";
        }
        return "Ese compa ya esta muerto xdxdxxdxdxdxd.";
    }
}

async function unbanUser(userId, senderId) {
    if (!(await esAdmin(senderId))) {
        return "Que crees que haces papu :v.";
    }

    try {
        // Eliminar de MongoDB Atlas
        const resultado = await Ban.findOneAndDelete({ userId });
        
        // Actualizar respaldo local
        const listaActualizada = await Ban.find({});
        guardarJsonLocal(BANS_FILE, listaActualizada);

        if (!resultado) {
            // Verificar si estaba localmente por si acaso
            let listaLocal = leerJsonLocal(BANS_FILE);
            const filtrados = listaLocal.filter(b => (b.userId || b) !== userId);
            if (filtrados.length !== listaLocal.length) {
                guardarJsonLocal(BANS_FILE, filtrados);
                console.log(`[BANS] Usuario desbaneado localmente: ${userId}`);
                return "Despierta papu";
            }
            return "Ese papu esta en papulandia";
        }

        console.log(`[BANS] Usuario desbaneado en MongoDB: ${userId}`);
        return "Despierta papu";
    } catch (e) {
        console.error("Error al desbanear:", e);
        return "Hubo un error al procesar el desbaneo.";
    }
}

async function getListaBaneados() {
    return await cargarBaneos();
}

module.exports = {
    esAdmin,
    cargarBaneos,
    banUser,
    unbanUser,
    getListaBaneados
};