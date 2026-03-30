const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');

(async () => {
    const db = await open({
        filename: 'archipeg_data.db',
        driver: sqlite3.Database
    });

    const fotos = await db.all("SELECT id, imagen_url FROM fotos");
    console.log(`Analizando mágicamente ${fotos.length} fotos con Inteligencia de Rutas...`);

    let actualizadasPorCarpeta = 0;
    for (const foto of fotos) {
        if (!foto.imagen_url) continue;
        
        // 1. Intentar extraer año de la ruta/nombre del archivo (ej: "Fotos 2015", "Vacaciones_2018")
        const matchAnio = foto.imagen_url.match(/(19\d{2}|20\d{2})/);
        let anio = null;

        if (matchAnio) {
            anio = parseInt(matchAnio[1], 10);
            actualizadasPorCarpeta++;
            // Update the year based on the folder string
            await db.run("UPDATE fotos SET anio = ? WHERE id = ?", [anio, foto.id]);
        }
    }
    
    console.log(`¡Éxito! Hemos corregido la fecha de ${actualizadasPorCarpeta} fotos usando los nombres de las carpetas.`);
})();
