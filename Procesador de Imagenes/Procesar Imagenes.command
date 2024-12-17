#!/bin/bash
cd "$(dirname "$0")"
echo "🖼  Iniciando procesador de imágenes..."
node index.js
echo "⏳ Presiona cualquier tecla para cerrar..."
read -n 1 -s
