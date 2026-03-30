const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function run() {
    const db = await open({
        filename: path.join(__dirname, 'archipeg_data.db'),
        driver: sqlite3.Database
    });
    const schema = await db.all("PRAGMA table_info(albumes);");
    console.log("Albumes columns:", schema);
    process.exit(0);
}
run();
