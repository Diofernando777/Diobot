
const path = require('path');
const puppeteer = require('puppeteer');

async function ejecutarNota(sock, msg, content, from) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        // Ruta actualizada apuntando a assets/paginas/notas/nota.html
        const htmlPath = path.join(__dirname, '../assets/paginas/notas/nota.html');
        const textoParam = encodeURIComponent(content.slice(5).trim());
        const url = `file://${htmlPath}?texto=${textoParam}`;

        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.setViewport({ width: 400, height: 400 });
        
        const screenshot = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 400 } });
        await browser.close();

        await sock.sendMessage(from, { image: screenshot }, { quoted: msg });
    } catch (e) {
        if (browser) await browser.close();
        console.error("❌ ERROR NOTA:", e);
        await sock.sendMessage(from, { text: "Fallo épicamente la nota" });
    }
}

module.exports = { ejecutarNota };