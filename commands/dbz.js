// commands/dbz.js
const puppeteer = require('puppeteer');
const path = require('path');

async function ejecutarDbz(sock, msg, content, from) {
    try {
        // Obtenemos el texto limpio eliminando el comando !dbz o dbz
        const texto = content.replace(/^dbz/i, "").trim();

        const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        // Ruta corregida a assets/paginas/dbz/index.html desde commands/
        const dbzHtmlPath = path.join(__dirname, '..', 'assets', 'paginas', 'dbz', 'index.html');
        const url = `file://${dbzHtmlPath}?texto=${encodeURIComponent(texto)}`;
        
        await page.goto(url, { waitUntil: 'networkidle0' });
        
        // Dimensiones específicas para DBZ: 853x480
        await page.setViewport({ width: 853, height: 480 });
        
        const screenshot = await page.screenshot({ 
            clip: { x: 0, y: 0, width: 853, height: 480 } 
        });
        
        await browser.close();
        await sock.sendMessage(from, { image: screenshot }, { quoted: msg });
    } catch (e) { 
        console.error("Error en DBZ:", e);
        await sock.sendMessage(from, { text: "Padre Ball murio" }); 
    }
}

module.exports = { ejecutarDbz };