const mongoose = require('mongoose');

const LASTFM_API_KEY = '4080ffe11cd5d224d49a4124abb1a034';

const userLastFmSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastfmUsername: { type: String, required: true }
}, { 
    collection: 'lastfm'
});

const UserLastFm = mongoose.models.UserLastFm || mongoose.model('UserLastFm', userLastFmSchema);

async function obtenerUltimaPista(username) {
    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(username)}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error || !data.recenttracks?.track || data.recenttracks.track.length === 0) {
            return null;
        }

        const cancion = data.recenttracks.track[0];
        
        const imagenes = cancion.image || [];
        let imageUrl = "";
        for (let i = imagenes.length - 1; i >= 0; i--) {
            if (imagenes[i]['#text']) {
                imageUrl = imagenes[i]['#text'];
                break;
            }
        }

        return {
            artista: cancion.artist['#text'],
            titulo: cancion.name,
            album: cancion.album['#text'] || '',
            nowPlaying: cancion['@attr'] && cancion['@attr'].nowplaying === 'true',
            image: imageUrl
        };
    } catch (e) {
        console.error("Error al conectar con la API de Last.fm:", e);
        return null;
    }
}

async function handleSetCommand(sock, msg, msgText, from, senderId) {
    const lastfmUsername = msgText.replace('-set', '').trim();
    if (!lastfmUsername) {
        await sock.sendMessage(from, { text: "Por favor ingresa tu usuario. Ejemplo: `-set tu_usuario`" });
        return;
    }
    try {
        await UserLastFm.findOneAndUpdate(
            { userId: senderId },
            { lastfmUsername: lastfmUsername },
            { upsert: true, returnDocument: 'after' }
        );
        await sock.sendMessage(from, { text: `Tu usuario de Last.fm quedó vinculado como: *${lastfmUsername}*` });
    } catch (error) {
        console.error("Error guardando en MongoDB:", error);
        await sock.sendMessage(from, { text: "Hubo un error al guardar tu usuario en la base de datos." });
    }
}

async function handleFmCommand(sock, msg, msgText, from, senderId) {
    try {
        let targetUserId = senderId;
        let queryExtra = msgText.replace('-fm', '').trim();

        // 1. Verificar si hay usuario mencionado en el mensaje (ej: -fm @usuario)
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJids && mentionedJids.length > 0) {
            targetUserId = mentionedJids[0];
        } 
        // 2. Si no hay mención pero escribieron un texto después (ej: -fm nombre_lastfm)
        else if (queryExtra) {
            // Buscamos si existe un registro con ese exacto lastfmUsername
            const registroPorNombre = await UserLastFm.findOne({ 
                lastfmUsername: { $regex: new RegExp(`^${queryExtra}$`, 'i') } 
            });
            if (registroPorNombre) {
                targetUserId = registroPorNombre.userId;
            } else {
                // Si escribieron un texto que no coincide con nadie registrado, probamos directo como usuario de Last.fm
                const username = queryExtra;
                const pista = await obtenerUltimaPista(username);
                if (!pista) {
                    await sock.sendMessage(from, { text: `No se encontró información de Last.fm para el usuario *${username}*.` });
                    return;
                }
                
                let texto = pista.nowPlaying 
                    ? ` *${username} está escuchando ahora mismo:*\n\n` 
                    : `*Última reproducción de ${username}:*\n\n`;

                texto += `*Artista:* ${pista.artista}\n` +
                         `*Canción:* ${pista.titulo}\n` +
                         (pista.album ? ` *Álbum:* ${pista.album}` : "");

                if (pista.image) {
                    await sock.sendMessage(from, { image: { url: pista.image }, caption: texto });
                } else {
                    await sock.sendMessage(from, { text: texto });
                }
                return;
            }
        }

        // Buscar en la base de datos el ID objetivo (sea el propio remitente o el mencionado)
        const registro = await UserLastFm.findOne({ userId: targetUserId });
        if (!registro) {
            const esMencion = targetUserId !== senderId;
            const mensajeError = esMencion 
                ? " La persona que mencionaste aún no ha configurado su cuenta de Last.fm con `-set`." 
                : "Aún no has configurado tu cuenta de Last.fm.\nUsa `-set (tu_usuario)` primero.";
            
            await sock.sendMessage(from, { text: mensajeError });
            return;
        }

        const username = registro.lastfmUsername;
        const pista = await obtenerUltimaPista(username);

        if (!pista) {
            await sock.sendMessage(from, { text: `No se pudo obtener información de Last.fm para *${username}*.` });
            return;
        }

        let texto = pista.nowPlaying 
            ? `🎧 *${username} está escuchando ahora mismo:*\n\n` 
            : `🎵 *Última reproducción de ${username}:*\n\n`;

        texto += `🎤 *Artista:* ${pista.artista}\n` +
                 `🎼 *Canción:* ${pista.titulo}\n` +
                 (pista.album ? `💿 *Álbum:* ${pista.album}` : "");

        if (pista.image) {
            await sock.sendMessage(from, { 
                image: { url: pista.image }, 
                caption: texto 
            });
        } else {
            await sock.sendMessage(from, { text: texto });
        }

    } catch (error) {
        console.error("Error en -fm:", error);
        await sock.sendMessage(from, { text: "Ocurrió un error al consultar Last.fm." });
    }
}

async function handleNowCommand(sock, msg, from) {
    try {
        const usuariosRegistrados = await UserLastFm.find({});
        if (usuariosRegistrados.length === 0) {
            await sock.sendMessage(from, { text: "Nadie ha configurado su cuenta de Last.fm con `-set` todavía." });
            return;
        }



        let resultadosGrupo = " *Música actual en el grupo:*\n\n";
        let contador = 0;

        for (const userDoc of usuariosRegistrados) {
            const pista = await obtenerUltimaPista(userDoc.lastfmUsername);
            if (pista) {
                const estado = pista.nowPlaying ? " [En vivo]" : " [Última]";
                resultadosGrupo += ` *${userDoc.lastfmUsername}* ${estado}\n` +
                                   `   └  ${pista.artista} - ${pista.titulo}\n\n`;
                contador++;
            }
        }

        if (contador === 0) {
            await sock.sendMessage(from, { text: " No se pudo obtener actividad reciente de los usuarios registrados." });
            return;
        }

        await sock.sendMessage(from, { text: resultadosGrupo });
    } catch (error) {
        console.error("Error en -now del grupo:", error);
        await sock.sendMessage(from, { text: "Ocurrió un error al consultar los scrobbles del grupo." });
    }
}

module.exports = {
    handleSetCommand,
    handleFmCommand,
    handleNowCommand
};