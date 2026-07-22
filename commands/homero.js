// commands/homero.js
const puppeteer = require('puppeteer');
const path = require('path');

async function ejecutarHomero(sock, msg, content, from) {
    try {
        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        // Ruta corregida a assets/paginas/homero/index.html desde commands/
        const homeroHtmlPath = path.join(__dirname, '..', 'assets', 'paginas', 'homero', 'index.html');
        const url = `file://${homeroHtmlPath}?texto=${encodeURIComponent(content.slice(7))}`;
        
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        // Establecemos el viewport exactamente a 720x429
        await page.setViewport({ width: 720, height: 429 });
        
        // Capturamos el área completa sin deformar (recorte 1:1)
        const screenshot = await page.screenshot({ 
            clip: { x: 0, y: 0, width: 720, height: 429 } 
        });
        
        await browser.close();
        await sock.sendMessage(from, { image: screenshot }, { quoted: msg });
    } catch (e) { 
        console.error("Error en Homero:", e);
        await sock.sendMessage(from, { text: "Dou" }); 
    }
}

module.exports = { ejecutarHomero };