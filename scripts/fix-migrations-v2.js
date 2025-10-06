#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script mejorado para detectar y corregir patrones DROP COLUMN seguidos de ADD COLUMN
 * en archivos de migración TypeORM, reemplazándolos por MODIFY COLUMN
 * Versión 2: Solo procesa dentro del método up() y mantiene la estructura correcta
 */

function fixMigrationFile(filePath) {
    console.log(`Procesando archivo: ${filePath}`);
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        let changesMade = false;
        
        // Buscar el método up() específicamente
        const upMethodStart = content.indexOf('public async up(queryRunner: QueryRunner): Promise<void> {');
        if (upMethodStart === -1) {
            console.log('No se encontró el método up() en el archivo');
            return false;
        }
        
        // Encontrar el final del método up()
        let braceCount = 0;
        let upMethodEnd = upMethodStart;
        let inUpMethod = false;
        
        for (let i = upMethodStart; i < content.length; i++) {
            if (content[i] === '{') {
                braceCount++;
                inUpMethod = true;
            } else if (content[i] === '}') {
                braceCount--;
                if (inUpMethod && braceCount === 0) {
                    upMethodEnd = i;
                    break;
                }
            }
        }
        
        if (upMethodEnd === upMethodStart) {
            console.log('No se pudo determinar el final del método up()');
            return false;
        }
        
        // Extraer solo el contenido del método up()
        const upMethodContent = content.substring(upMethodStart, upMethodEnd + 1);
        
        // Buscar patrones DROP COLUMN seguidos de ADD COLUMN para la misma tabla y columna
        // Actualizado para soportar el nuevo formato con strings regulares
        const dropPattern = /await queryRunner\.query\("ALTER TABLE `([^`]+)` DROP COLUMN `([^`]+)`"\);/g;
        const addPattern = /await queryRunner\.query\("ALTER TABLE `([^`]+)` ADD `([^`]+)` (.*?)"\);/g;
        
        let dropMatches = [...upMethodContent.matchAll(dropPattern)];
        let addMatches = [...upMethodContent.matchAll(addPattern)];
        
        console.log(`Encontrados ${dropMatches.length} DROP COLUMN y ${addMatches.length} ADD COLUMN en up()`);
        
        let modifiedUpContent = upMethodContent;
        
        // Buscar coincidencias DROP COLUMN y ADD COLUMN para la misma tabla y columna
        for (let dropMatch of dropMatches) {
            const dropTable = dropMatch[1];
            const dropColumn = dropMatch[2];
            const dropFullText = dropMatch[0];
            
            // Verificar que sea realmente un DROP COLUMN (no DROP FOREIGN KEY u otros)
            if (dropFullText.includes('DROP COLUMN') && !dropFullText.includes('DROP FOREIGN KEY')) {
                // Buscar ADD correspondiente
                for (let addMatch of addMatches) {
                    const addTable = addMatch[1];
                    const addColumn = addMatch[2];
                    const addDefinition = addMatch[3];
                    const addFullText = addMatch[0];
                    
                    if (dropTable === addTable && dropColumn === addColumn) {
                        console.log(`Encontrado patrón DROP+ADD para corregir:`);
                        console.log(`  Tabla: ${dropTable}, Columna: ${dropColumn}`);
                        console.log(`  DROP: ${dropFullText}`);
                        console.log(`  ADD: ${addFullText}`);
                        
                        // Crear la línea MODIFY COLUMN
                        // Limpiar la definición de columna
                        let cleanDefinition = addDefinition.replace(/\);$/, '');
                        // Corregir específicamente el problema de DEFAULT ''NULL'' -> DEFAULT 'NULL'
                        cleanDefinition = cleanDefinition.replace(/DEFAULT ''NULL''/g, "DEFAULT 'NULL'");
                        // Corregir comillas simples duplicadas
                        cleanDefinition = cleanDefinition.replace(/'{2,}/g, "'");
                        // Corregir comillas dobles duplicadas
                        cleanDefinition = cleanDefinition.replace(/"{2,}/g, '"');
                        
                        const modifyStatement = `await queryRunner.query("ALTER TABLE \`${dropTable}\` MODIFY COLUMN \`${dropColumn}\` ${cleanDefinition}");`;
                        
                        console.log(`  Reemplazando por MODIFY: ${modifyStatement}`);
                        
                        // Reemplazar DROP + ADD por MODIFY (sin conservar ADD)
                        modifiedUpContent = modifiedUpContent.replace(dropFullText, modifyStatement);
                        modifiedUpContent = modifiedUpContent.replace(addFullText, '');
                        
                        changesMade = true;
                        break;
                    }
                }
            }
        }
        
        if (changesMade) {
            // Limpiar líneas vacías adicionales
            modifiedUpContent = modifiedUpContent.replace(/\n\s*\n\s*\n/g, '\n\n');
            modifiedUpContent = modifiedUpContent.replace(/\n\s*\n/g, '\n');
            
            // Reemplazar el contenido del método up() en el archivo completo
            content = content.substring(0, upMethodStart) + modifiedUpContent + content.substring(upMethodEnd + 1);
            
            // Hacer backup del archivo original
            //const backupPath = filePath + '.backup';
            //fs.writeFileSync(backupPath, originalContent);
            //console.log(`Backup creado: ${backupPath}`);
            
            // Escribir el archivo corregido
            fs.writeFileSync(filePath, content);
            console.log(`Archivo corregido: ${filePath}`);
        } else {
            console.log('No se encontraron patrones DROP+ADD para corregir en up().');
        }
        
        return changesMade;
        
    } catch (error) {
        console.error(`Error procesando archivo ${filePath}:`, error.message);
        return false;
    }
}

function findMigrationFiles(directory) {
    console.log(`Buscando archivos de migración en: ${directory}`);
    
    const migrationFiles = [];
    
    function searchDir(dir) {
        try {
            const files = fs.readdirSync(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    searchDir(filePath);
                } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                    if (file.includes('migration') || /^\d+-\w+\.(ts|js)$/.test(file)) {
                        migrationFiles.push(filePath);
                    }
                }
            }
        } catch (error) {
            console.error(`Error accediendo al directorio ${dir}:`, error.message);
        }
    }
    
    searchDir(directory);
    return migrationFiles;
}

function main() {
    const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
    const distMigrationsDir = path.join(__dirname, 'dist', 'database', 'migrations');
    
    console.log('=== Script de corrección de migraciones (v2) ===\n');
    console.log('NOTA: Esta versión solo procesa dentro del método up()');
    console.log('y mantiene la estructura correcta de los métodos.\n');
    
    // Procesar archivos de migración en src
    if (fs.existsSync(migrationsDir)) {
        const srcFiles = findMigrationFiles(migrationsDir);
        console.log(`Encontrados ${srcFiles.length} archivos de migración en src`);
        
        let srcChanges = 0;
        srcFiles.forEach(file => {
            if (fixMigrationFile(file)) {
                srcChanges++;
            }
            console.log(''); // Línea en blanco entre archivos
        });
        
        console.log(`Corregidos ${srcChanges} archivos en src/database/migrations`);
    } else {
        console.log('Directorio src/database/migrations no encontrado');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Procesar archivos de migración en dist
    if (fs.existsSync(distMigrationsDir)) {
        const distFiles = findMigrationFiles(distMigrationsDir);
        console.log(`Encontrados ${distFiles.length} archivos de migración en dist`);
        
        let distChanges = 0;
        distFiles.forEach(file => {
            if (fixMigrationFile(file)) {
                distChanges++;
            }
            console.log(''); // Línea en blanco entre archivos
        });
        
        console.log(`Corregidos ${distChanges} archivos en dist/database/migrations`);
    } else {
        console.log('Directorio dist/database/migrations no encontrado');
    }
    
    console.log('\n=== Proceso completado ===');
}

// Ejecutar el script
if (require.main === module) {
    main();
}

module.exports = { fixMigrationFile, findMigrationFiles };