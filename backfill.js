const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');

(async () => {
    const db = await open({
        filename: 'archipeg_data.db',
        driver: sqlite3.Database
    });

    const fotos = await db.all("SELECT id, imagen_url FROM fotos WHERE anio IS NULL OR mes IS NULL");
    console.log(`Encontradas ${fotos.length} fotos sin fecha.`);

    let actualizadas = 0;
    for (const foto of fotos) {
        if (!foto.imagen_url) continue;
        try {
            const stat = fs.statSync(foto.imagen_url);
            // Get the oldest date possible (birthtime, or mtime if birthtime not supported)
            const d = new Date(Math.min(stat.mtimeMs, stat.ctimeMs, stat.birthtimeMs || Infinity));
            
            if (!isNaN(d.getFullYear())) {
                const anio = d.getFullYear();
                const mes = d.getMonth() + 1;
                
                await db.run("UPDATE fotos SET anio = ?, mes = ? WHERE id = ?", [anio, mes, foto.id]);
                actualizadas++;
            }
        } catch (err) {
            // Ignore missing files or permission errors
        }
    }
    
    console.log(`Actualizadas ${actualizadas} fotos con éxito.`);
})();
