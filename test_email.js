const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Intentamos cargar el .env
try {
    require('dotenv').config();
} catch (e) {
    console.error("⚠️ No se pudo cargar el archivo .env");
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'archipegv2@gmail.com',
        pass: process.env.EMAIL_PASS
    }
});

const mailOptions = {
    from: `"Prueba Archipeg 🚀" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // Nos lo enviamos a nosotros mismos para probar
    subject: '✅ PRUEBA DE CORREO - Archipeg Pro',
    text: '¡Hermano! Si recibes esto, es que la contraseña de aplicación funciona perfectamente. Archipeg ya puede enviar correos automáticos. 🚀',
    html: '<h3>¡Hermano! 🚀</h3><p>Si recibes esto, es que la <b>contraseña de aplicación</b> funciona perfectamente.</p><p>Archipeg ya puede enviar correos automáticos a los usuarios aprobados. ✅</p>'
};

console.log("-----------------------------------------");
console.log("🚀 INICIANDO PRUEBA DE CORREO...");
console.log(`📧 Cuenta: ${process.env.EMAIL_USER}`);
console.log(`🔑 Clave detectada: ${process.env.EMAIL_PASS ? (process.env.EMAIL_PASS.length + " caracteres") : "❌ VACÍA"}`);
console.log("-----------------------------------------");

if (!process.env.EMAIL_PASS || process.env.EMAIL_PASS.includes('TU_CONTRASEÑA')) {
    console.error("❌ ERROR: Aún no has puesto la contraseña de 16 letras en el archivo .env");
    process.exit(1);
}

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("❌ ERROR AL ENVIAR EL CORREO:");
        console.error(error);
    } else {
        console.log("✅ ¡CORREO ENVIADO CON ÉXITO!");
        console.log("📩 Revisa tu bandeja de entrada de Gmail.");
        console.log("Respuesta: " + info.response);
    }
});
