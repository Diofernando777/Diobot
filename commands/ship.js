async function ejecutarShip(sock, msg, from) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const sender = msg.key.participant || msg.key.remoteJid;

    if (mentioned.length === 0) {
        return await sock.sendMessage(from, { text: "Menciona al menos a una persona, papu." });
    }

    let usuario1, usuario2;

    if (mentioned.length >= 2) {
        // Caso: Dos personas mencionadas -> Se usan las dos mencionadas
        usuario1 = mentioned[0];
        usuario2 = mentioned[1];
    } else {
        // Caso: Una sola persona mencionada -> Se usa el emisor + el mencionado
        usuario1 = sender;
        usuario2 = mentioned[0];
    }

    const compatibility = Math.floor(Math.random() * 101);

    const resultado = `*Resultado de Pareja* ❤️\n\n` +
                      `👤 @${usuario1.split('@')[0]} + @${usuario2.split('@')[0]}\n` +
                      `❤️ Compatibilidad: ${compatibility}%`;

    await sock.sendMessage(from, { 
        text: resultado,
        mentions: [usuario1, usuario2]
    });
}

module.exports = { ejecutarShip };