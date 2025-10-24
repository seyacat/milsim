#!/usr/bin/env node

/**
 * Script para agregar logs automáticamente cada vez que el websocket envíe un evento al frontend
 * Este script modifica el archivo broadcast-utilities.handler.ts para agregar console.log antes de cada server.to().emit()
 */

const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'src', 'games', 'handlers', 'broadcast-utilities.handler.ts');

function addWebsocketLogs() {
  try {
    // Leer el archivo
    let content = fs.readFileSync(targetFile, 'utf8');
    
    // Buscar todas las líneas que contengan server.to().emit() y agregar log antes
    const lines = content.split('\n');
    const modifiedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Si la línea contiene server.to().emit(), agregar log antes
      if (line.includes('server.to(') && line.includes('.emit(')) {
        // Encontrar la indentación de la línea actual
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        
        // Agregar línea de log con la misma indentación
      }
      
      modifiedLines.push(line);
    }
    
    // Escribir el archivo modificado
    const modifiedContent = modifiedLines.join('\n');
    fs.writeFileSync(targetFile, modifiedContent, 'utf8');
    
    
  } catch (error) {
    console.error('❌ Error al modificar el archivo:', error.message);
    process.exit(1);
  }
}

// Ejecutar el script
addWebsocketLogs();
