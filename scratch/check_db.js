const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function check() {
    try {
        const db = await open({
            filename: path.join(__dirname, 'archipeg_data.db'),
            driver: sqlite3.Database
        });
        const count = await db.get("SELECT COUNT(*) as total FROM fotos");
        const events = await db.get("SELECT COUNT(*) as total FROM eventos");
        console.log(`📊 TOTAL FOTOS EN DB: ${count.total}`);
        console.log(`📊 TOTAL EVENTOS EN DB: ${events.total}`);
        await db.close();
    } catch (e) {
        console.error("❌ ERROR AL LEER DB:", e.message);
    }
}
check();
