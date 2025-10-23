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

// Función para agregar el log de renderizado de forma segura
function addRenderLog(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar si ya tiene un log de renderizado
    if (content.includes('console.log(') && content.includes('rendered')) {
      console.log(`Ya tiene log: ${filePath}`);
      return false;
    }
    
    const lines = content.split('\n');
    let componentName = path.basename(filePath, '.tsx');
    let componentStartLine = -1;
    let componentEndLine = -1;
    
    // Buscar la línea donde empieza el componente
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Buscar diferentes patrones de definición de componentes
      if (line.startsWith('const ') && (line.includes(': React.FC') || line.includes('= (') || line.includes('= React.')) ||
          line.startsWith('function ') ||
          line.startsWith('export default ') && (line.includes('React.FC') || line.includes('function') || line.includes('const'))) {
        
        // Extraer el nombre del componente
        const match = line.match(/(?:const|function)\s+(\w+)/);
        if (match) {
          componentName = match[1];
        }
        componentStartLine = i;
        break;
      }
    }
    
    if (componentStartLine === -1) {
      console.log(`No se pudo encontrar el componente en: ${filePath}`);
      return false;
    }
    
    // Buscar la línea donde termina la definición de props y empieza el cuerpo
    let bodyStartLine = -1;
    let braceCount = 0;
    let inProps = false;
    
    for (let i = componentStartLine; i < lines.length; i++) {
      const line = lines[i];
      
      // Contar llaves para encontrar el inicio del cuerpo
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          if (braceCount === 1) {
            // Primera llave - podría ser la de props o la del cuerpo
            inProps = true;
          } else if (braceCount === 2 && inProps) {
            // Segunda llave - fin de props, inicio del cuerpo
            bodyStartLine = i;
            break;
          }
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && inProps) {
            // Fin de props
            bodyStartLine = i + 1;
            break;
          }
        }
      }
      
      if (bodyStartLine !== -1) break;
      
      // Si encontramos => después de props, ese es el inicio del cuerpo
      if (line.includes('=>') && braceCount === 0) {
        bodyStartLine = i + 1;
        break;
      }
    }
    
    // Si no encontramos el inicio del cuerpo, buscar después del último paréntesis
    if (bodyStartLine === -1) {
      for (let i = componentStartLine; i < lines.length; i++) {
        if (lines[i].includes(')')) {
          bodyStartLine = i + 1;
          break;
        }
      }
    }
    
    if (bodyStartLine === -1 || bodyStartLine >= lines.length) {
      console.log(`No se pudo encontrar el cuerpo del componente en: ${filePath}`);
      return false;
    }
    
    // Insertar el log al inicio del cuerpo del componente
    const indent = lines[bodyStartLine].match(/^(\s*)/)?.[0] || '  ';
    const logLine = `${indent}console.log('${componentName} rendered');`;
    
    // Insertar la línea del log
    lines.splice(bodyStartLine, 0, logLine);
    
    // Escribir el archivo modificado
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`✓ Log agregado a: ${componentName} (${filePath})`);
    return true;
    
  } catch (error) {
    console.error(`Error procesando ${filePath}:`, error.message);
    return false;
  }
}

// Función principal
function main() {
  console.log('Buscando componentes React...');
  
  const components = findReactComponents(componentsDir);
  console.log(`Encontrados ${components.length} componentes React`);
  
  let modifiedCount = 0;
  
  components.forEach(componentPath => {
    if (addRenderLog(componentPath)) {
      modifiedCount++;
    }
  });
  
  console.log(`\n✅ Proceso completado. ${modifiedCount} componentes modificados de ${components.length} totales.`);
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { findReactComponents, addRenderLog };