const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('canvas');

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
        const url = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=" + encodeURIComponent(username) + "&api_key=" + LASTFM_API_KEY + "&format=json&limit=1";
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
        await sock.sendMessage(from, { text: "Tu usuario de Last.fm quedó vinculado como: *" + lastfmUsername + "*" });
    } catch (error) {
        console.error("Error guardando en MongoDB:", error);
        await sock.sendMessage(from, { text: "Hubo un error al guardar tu usuario en la base de datos." });
    }
}

async function handleFmCommand(sock, msg, msgText, from, senderId) {
    try {
        let targetUserId = senderId;
        let queryExtra = msgText.replace('-fm', '').trim();

        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJids && mentionedJids.length > 0) {
            targetUserId = mentionedJids[0];
        } 
        else if (queryExtra) {
            // Reescrito sin el símbolo de dólar para evitar errores al pegar
            const registroPorNombre = await UserLastFm.findOne({ 
                lastfmUsername: new RegExp("^" + queryExtra + "$", 'i')
            });
            if (registroPorNombre) {
                targetUserId = registroPorNombre.userId;
            } else {
                const username = queryExtra;
                const pista = await obtenerUltimaPista(username);
                if (!pista) {
                    await sock.sendMessage(from, { text: "No se encontró información de Last.fm para el usuario *" + username + "*." });
                    return;
                }
                
                let texto = pista.nowPlaying 
                    ? " *" + username + " está escuchando ahora mismo:*\n\n" 
                    : "*Última reproducción de " + username + ":*\n\n";

                texto += "*Artista:* " + pista.artista + "\n" +
                         "*Canción:* " + pista.titulo + "\n" +
                         (pista.album ? " *Álbum:* " + pista.album : "");

                if (pista.image) {
                    await sock.sendMessage(from, { image: { url: pista.image }, caption: texto });
                } else {
                    await sock.sendMessage(from, { text: texto });
                }
                return;
            }
        }

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
            await sock.sendMessage(from, { text: "No se pudo obtener información de Last.fm para *" + username + "*." });
            return;
        }

        let texto = pista.nowPlaying 
            ? "🎧 *" + username + " está escuchando ahora mismo:*\n\n" 
            : "🎵 *Última reproducción de " + username + ":*\n\n";

        texto += "🎤 *Artista:* " + pista.artista + "\n" +
                 "🎼 *Canción:* " + pista.titulo + "\n" +
                 (pista.album ? "💿 *Álbum:* " + pista.album : "");

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
                resultadosGrupo += " *" + userDoc.lastfmUsername + "* " + estado + "\n" +
                                   "   └  " + pista.artista + " - " + pista.titulo + "\n\n";
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

async function handleCCommand(sock, msg, msgText, from, senderId) {
    try {
        let targetUserId = senderId;
        let queryExtra = msgText.replace('-c', '').trim();
        
        let period = '1month';
        let periodText = 'Últimos 30 días';

        if (queryExtra.includes('-y')) {
            period = '12month';
            periodText = 'Último año';
            queryExtra = queryExtra.replace('-y', '').trim();
        } else if (queryExtra.includes('-all')) {
            period = 'overall';
            periodText = 'De todos los tiempos';
            queryExtra = queryExtra.replace('-all', '').trim();
        }

        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (mentionedJids && mentionedJids.length > 0) {
            targetUserId = mentionedJids[0];
        } else if (queryExtra) {
            const registroPorNombre = await UserLastFm.findOne({ 
                lastfmUsername: new RegExp("^" + queryExtra + "$", 'i') 
            });
            if (registroPorNombre) {
                targetUserId = registroPorNombre.userId;
            } else {
                targetUserId = null;
            }
        }

        let username = queryExtra;
        if (targetUserId) {
            const registro = await UserLastFm.findOne({ userId: targetUserId });
            if (!registro) {
                await sock.sendMessage(from, { text: "Esa persona o tú no han configurado su cuenta con `-set`." });
                return;
            }
            username = registro.lastfmUsername;
        }

        if (!username) {
             await sock.sendMessage(from, { text: "No se pudo determinar el usuario de Last.fm." });
             return;
        }

        const url = "https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=" + encodeURIComponent(username) + "&api_key=" + LASTFM_API_KEY + "&period=" + period + "&limit=25&format=json";
        const response = await fetch(url);
        const data = await response.json();

        if (data.error || !data.topalbums?.album || data.topalbums.album.length === 0) {
            await sock.sendMessage(from, { text: "No se encontró suficiente actividad de álbumes para *" + username + "*." });
            return;
        }

        const albums = data.topalbums.album;
        
        const canvas = createCanvas(1500, 1500);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1500, 1500);

        let x = 0;
        let y = 0;

        for (let i = 0; i < albums.length && i < 25; i++) {
            const album = albums[i];
            const images = album.image || [];
            let imageUrl = "";
            
            for (let j = images.length - 1; j >= 0; j--) {
                if (images[j]['#text']) {
                    imageUrl = images[j]['#text'];
                    break;
                }
            }

            if (imageUrl) {
                try {
                    const img = await loadImage(imageUrl);
                    ctx.drawImage(img, x, y, 300, 300);
                } catch (err) {
                    console.error("Error cargando carátula en el chart:", err);
                }
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.font = '24px Arial';
                ctx.fillText(album.name.substring(0, 20), x + 20, y + 150);
            }

            x += 300;
            if (x >= 1500) {
                x = 0;
                y += 300;
            }
        }

        const buffer = canvas.toBuffer('image/png');

        await sock.sendMessage(from, { 
            image: buffer, 
            caption: "📊 *Top Álbumes 5x5 (" + periodText + ")*\n👤 Usuario: " + username 
        });

    } catch (error) {
        console.error("Error en -c:", error);
        await sock.sendMessage(from, { text: "Ocurrió un error al generar el chart." });
    }
}

async function handleCompatCommand(sock, msg, from, senderId) {
    try {
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let userA_id, userB_id;

        if (mentionedJids.length === 0) {
            await sock.sendMessage(from, { text: "Debes mencionar al menos a una persona. Ejemplos:\n`-compat @usuario1` (Tú y el mencionado)\n`-compat @usuario1 @usuario2` (Entre los dos mencionados)" });
            return;
        } else if (mentionedJids.length === 1) {
            userA_id = senderId;
            userB_id = mentionedJids[0];
        } else {
            userA_id = mentionedJids[0];
            userB_id = mentionedJids[1];
        }

        if (userA_id === userB_id) {
            await sock.sendMessage(from, { text: "No puedes medir la compatibilidad de una persona consigo misma." });
            return;
        }

        const [registroA, registroB] = await Promise.all([
            UserLastFm.findOne({ userId: userA_id }),
            UserLastFm.findOne({ userId: userB_id })
        ]);

        if (!registroA || !registroB) {
            await sock.sendMessage(from, { text: "Uno de los usuarios (o ambos) no ha configurado su cuenta de Last.fm con `-set`." });
            return;
        }


        const urlA = "https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=" + encodeURIComponent(registroA.lastfmUsername) + "&api_key=" + LASTFM_API_KEY + "&period=overall&limit=100&format=json";
        const urlB = "https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=" + encodeURIComponent(registroB.lastfmUsername) + "&api_key=" + LASTFM_API_KEY + "&period=overall&limit=100&format=json";

        const [resA, resB] = await Promise.all([fetch(urlA), fetch(urlB)]);
        const dataA = await resA.json();
        const dataB = await resB.json();

        if (dataA.error || dataB.error || !dataA.topartists?.artist || !dataB.topartists?.artist) {
            await sock.sendMessage(from, { text: "Hubo un error al obtener los datos de Last.fm de los usuarios." });
            return;
        }

        const artistsA = dataA.topartists.artist;
        const artistsB = dataB.topartists.artist;

        let shared = [];
        for (let i = 0; i < artistsA.length; i++) {
            const artistName = artistsA[i].name;
            const indexB = artistsB.findIndex(a => a.name === artistName);
            if (indexB !== -1) {
                shared.push({
                    name: artistName,
                    score: i + indexB
                });
            }
        }

        let percentage = Math.min(100, Math.round((shared.length / 30) * 100));

        let level = "Muy baja";
        if (percentage >= 90) level = "Súper Alta";
        else if (percentage >= 70) level = "Alta";
        else if (percentage >= 50) level = "Media";
        else if (percentage >= 30) level = "Baja";

        shared.sort((a, b) => a.score - b.score);
        const top5 = shared.slice(0, 5);

        let texto = "🎵 *Compatibilidad Musical* 🎵\n";
        texto += "👤 *" + registroA.lastfmUsername + "*  x  👤 *" + registroB.lastfmUsername + "*\n\n";
        texto += "*Nivel:* " + level + " (" + percentage + "%)\n\n";

        if (top5.length > 0) {
            texto += " *Top 5 artistas en común:*\n";
            top5.forEach((a, i) => {
                texto += "*" + (i + 1) + ".* " + a.name + "\n";
            });
        } else {
            texto += "No tienen ningún artista en común.";
        }

        await sock.sendMessage(from, { text: texto });

    } catch (error) {
        console.error("Error en -compat:", error);
        await sock.sendMessage(from, { text: "Ocurrió un error al calcular la compatibilidad." });
    }
}

module.exports = {
    handleSetCommand,
    handleFmCommand,
    handleNowCommand,
    handleCCommand,
    handleCompatCommand
};