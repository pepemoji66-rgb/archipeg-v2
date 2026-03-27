#!/bin/bash
# Script para levantar ARCHIPEG en modo desarrollo

echo "🚀 Iniciando ARCHIPEG PRO..."

# Matar procesos previos en los puertos 3000 y 5001
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null

# Ir al directorio del proyecto
cd "$(dirname "$0")"

# Levantar backend en segundo plano
echo "▶ Iniciando backend (puerto 5001)..."
node server.js &
BACKEND_PID=$!

sleep 2

# Reconstruir frontend si hay cambios (opcional, comentar si no quieres rebuild)
# echo "▶ Construyendo frontend..."
# CI=true npm run build

# Servir el build estático en puerto 3000
echo "▶ Iniciando frontend (puerto 3000)..."
npx serve -s build -l 3000 > /tmp/archipeg-serve.log 2>&1 &
FRONTEND_PID=$!

# Esperar a que el frontend esté listo
echo "⏳ Esperando al frontend..."
until curl -s http://localhost:3000 > /dev/null 2>&1; do
    sleep 1
done

# Abrir navegador
echo "🌐 Abriendo navegador..."
open http://localhost:3000

echo ""
echo "✅ ARCHIPEG corriendo:"
echo "   Frontend → http://localhost:3000"
echo "   Backend  → http://localhost:5001"
echo ""
echo "Presiona Ctrl+C para detener todo."

# Capturar Ctrl+C y matar ambos procesos
trap "echo ''; echo '🛑 Deteniendo ARCHIPEG...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Mantener el script activo
wait
