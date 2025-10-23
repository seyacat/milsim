const fs = require('fs');
const path = require('path');

// Directorio base donde están los componentes
const componentsDir = path.join(__dirname, 'frontend', 'src', 'components');

// Función para buscar archivos .tsx recursivamente
function findReactComponents(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findReactComponents(filePath, fileList);
    } else if (file.endsWith('.tsx') && !file.endsWith('.test.tsx') && !file.endsWith('.spec.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Función para remover los logs de renderizado
function removeRenderLog(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar si tiene un log de renderizado
    if (!content.includes("console.log('") || !content.includes(' rendered')) {
      console.log(`No tiene log: ${filePath}`);
      return false;
    }
    
    // Remover líneas que contengan console.log con 'rendered'
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      return !line.includes("console.log('") || !line.includes(' rendered');
    });
    
    if (lines.length === filteredLines.length) {
      console.log(`No se encontraron logs para remover en: ${filePath}`);
      return false;
    }
    
    // Escribir el archivo modificado
    fs.writeFileSync(filePath, filteredLines.join('\n'), 'utf8');
    console.log(`✓ Log removido de: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`Error procesando ${filePath}:`, error.message);
    return false;
  }
}

// Función principal
function main() {
  console.log('Buscando componentes React con logs...');
  
  const components = findReactComponents(componentsDir);
  console.log(`Encontrados ${components.length} componentes React`);
  
  let modifiedCount = 0;
  
  components.forEach(componentPath => {
    if (removeRenderLog(componentPath)) {
      modifiedCount++;
    }
  });
  
  console.log(`\n✅ Proceso completado. ${modifiedCount} componentes limpiados de ${components.length} totales.`);
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { findReactComponents, removeRenderLog };