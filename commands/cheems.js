const cheemsifyLogic = (text) => {
    const expr = /[aáeéiíoóuú]+[^aáeéiíoóuúmnñry]/gi;
    return text.split(' ').map((word) => {
        const letters = word.match(/[a-z]/gi) || [];
        const upper = letters.filter(l => l === l.toUpperCase()).length;
        const charToInsert = upper > letters.length / 2 ? 'M' : 'm';
        
        return word.replace(expr, (value) => {
            return value.slice(0, value.length - 1) + charToInsert + value.slice(value.length - 1);
        });
    }).join(' ');
};

const handleCheemsCommand = async (sock, msg, from) => {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;
    const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const commandArgs = rawText.split(' ').slice(1).join(' ');

    const textToProcess = commandArgs || quotedText || "Nom pumsimstem temxtom pampum";
    const result = cheemsifyLogic(textToProcess);

    await sock.sendMessage(from, { text: result }, { quoted: msg });
};

module.exports = { handleCheemsCommand };