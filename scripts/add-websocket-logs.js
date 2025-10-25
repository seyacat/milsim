#!/usr/bin/env node

/**
 * Script simple y robusto para agregar logs automáticamente cada vez que el websocket envíe un evento al frontend
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const targetFile = path.join(projectRoot, 'src', 'games', 'handlers', 'broadcast-utilities.handler.ts');

function addWebsocketLogs() {
  try {
    
    if (!fs.existsSync(targetFile)) {
      console.error('❌ Archivo no encontrado:', targetFile);
      process.exit(1);
    }
    
    let content = fs.readFileSync(targetFile, 'utf8');
    
    // Método simple: buscar líneas específicas y agregar log antes
    const lines = content.split('\n');
    const newLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Agregar log antes de líneas específicas de server.to().emit()
      if (line.includes('server.to(') && line.includes('.emit(')) {
        // Extraer el nombre del evento
        let eventName = 'unknown';
        if (line.includes("'gameAction'")) eventName = 'gameAction';
        else if (line.includes("'gameUpdate'")) eventName = 'gameUpdate';
        else if (line.includes("'timeUpdate'")) eventName = 'timeUpdate';
        else if (line.includes("'controlPointTimeUpdate'")) eventName = 'controlPointTimeUpdate';
        else if (line.includes("'bombTimeUpdate'")) eventName = 'bombTimeUpdate';
        else if (line.includes("'positionChallengeUpdate'")) eventName = 'positionChallengeUpdate';
        
        // Agregar log con la misma indentación
        const indent = line.match(/^(\s*)/)[1] || '';
      }
      
      newLines.push(line);
    }
    
    const modifiedContent = newLines.join('\n');
    const logsAdded = (modifiedContent.match(/\[WEBSOCKET_SEND\]/g) || []).length;
    
    fs.writeFileSync(targetFile, modifiedContent, 'utf8');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addWebsocketLogs();
