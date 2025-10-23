#!/usr/bin/env node

/**
 * Script para detectar patrones problemáticos comunes en código SolidJS
 * que pueden causar errores silenciosos de renderizado
 */

import fs from 'fs';
import path from 'path';

// Patrones problemáticos a buscar
const PROBLEMATIC_PATTERNS = [
  {
    name: 'Acceso a signals sin invocar',
    pattern: /\b(\w+)\.(map|filter|reduce|find|some|every|length|forEach)\b/g,
    description: 'Las signals deben invocarse: games().map() en lugar de games.map()'
  },
  {
    name: 'Acceso a propiedades nulas sin verificar',
    pattern: /\{\s*(\w+\.\w+(?:\.\w+)*)\s*\}/g,
    description: 'Verificar propiedades: {game?.owner?.name} en lugar de {game.owner.name}'
  },
  {
    name: 'Uso de for loops en JSX',
    pattern: /for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+(\w+\(\))/g,
    description: 'Usar <For> en lugar de for loops en JSX'
  },
  {
    name: 'Acceso directo a props sin verificar',
    pattern: /props\.(\w+)(?!\?\.)/g,
    description: 'Considerar usar props?.prop en lugar de props.prop'
  }
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, lineNumber) => {
    PROBLEMATIC_PATTERNS.forEach(pattern => {
      const matches = [...line.matchAll(pattern.pattern)];
      matches.forEach(match => {
        issues.push({
          file: filePath,
          line: lineNumber + 1,
          pattern: pattern.name,
          description: pattern.description,
          code: line.trim(),
          match: match[0]
        });
      });
    });
  });

  return issues;
}

function scanDirectory(dirPath) {
  const issues = [];
  
  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.jsx')) {
        const fileIssues = checkFile(fullPath);
        issues.push(...fileIssues);
      }
    }
  }
  
  traverse(dirPath);
  return issues;
}

// Ejecutar el análisis
console.log('🔍 Analizando patrones problemáticos en código SolidJS...\n');

const srcDir = path.join(process.cwd(), 'src');
const issues = scanDirectory(srcDir);

if (issues.length === 0) {
  console.log('✅ No se encontraron patrones problemáticos.');
} else {
  console.log(`⚠️  Se encontraron ${issues.length} posibles problemas:\n`);
  
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.pattern}`);
    console.log(`   Archivo: ${issue.file}`);
    console.log(`   Línea: ${issue.line}`);
    console.log(`   Código: ${issue.code}`);
    console.log(`   Problema: ${issue.description}`);
    console.log(`   Match: ${issue.match}`);
    console.log('');
  });
}

// Mostrar resumen por tipo de patrón
const summary = {};
issues.forEach(issue => {
  summary[issue.pattern] = (summary[issue.pattern] || 0) + 1;
});

console.log('📊 Resumen por tipo de patrón:');
Object.entries(summary).forEach(([pattern, count]) => {
  console.log(`   ${pattern}: ${count} ocurrencias`);
});

console.log('\n💡 Recomendaciones:');
console.log('   - Usar signals invocadas: games() en lugar de games');
console.log('   - Verificar propiedades nulas: game?.owner?.name');
console.log('   - Usar <For> para iterar arrays en JSX');
console.log('   - Considerar valores por defecto para props opcionales');