#!/usr/bin/env node

/**
 * Script para eliminar console.log con las siguientes reglas:
 * 1. Borrar todos los console.log
 * 2. Si el console.log está dentro de un catch, cambiarlo por console.error
 * 3. Si el console.log deja un bloque vacío, no borrarlo
 */

const fs = require('fs');
const path = require('path');

class ConsoleLogRemover {
    constructor() {
        this.processedFiles = 0;
        this.modifiedFiles = 0;
        this.totalConsoleLogs = 0;
        this.convertedToError = 0;
        this.preservedEmptyBlocks = 0;
    }

    /**
     * Procesa un archivo JavaScript
     */
    processFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const originalLines = content.split('\n');
            const processedLines = this.processLines(originalLines);
            
            if (JSON.stringify(originalLines) !== JSON.stringify(processedLines)) {
                fs.writeFileSync(filePath, processedLines.join('\n'), 'utf8');
                this.modifiedFiles++;
            } else {
                console.log(`Sin cambios: ${filePath}`);
            }
            
            this.processedFiles++;
        } catch (error) {
            console.error(`Error procesando ${filePath}:`, error.message);
        }
    }

    /**
     * Procesa las líneas de un archivo aplicando las reglas
     */
    processLines(lines) {
        const result = [];
        let inCatchBlock = false;
        let catchDepth = 0;
        let inMultiLineConsoleLog = false;
        let consoleLogLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Detectar inicio de bloque catch
            if (trimmedLine.startsWith('catch') || trimmedLine.includes('catch (')) {
                inCatchBlock = true;
                catchDepth = this.getBraceDepth(lines, i);
                result.push(line);
                continue;
            }

            // Detectar fin de bloque catch
            if (inCatchBlock && this.isEndOfCatchBlock(lines, i, catchDepth)) {
                inCatchBlock = false;
                result.push(line);
                continue;
            }

            // Detectar console.log que abarca múltiples líneas
            if (this.isConsoleLogStart(trimmedLine) && !this.isConsoleLogComplete(trimmedLine)) {
                inMultiLineConsoleLog = true;
                consoleLogLines = [line];
                continue;
            }

            // Continuar recopilando líneas de console.log multi-línea
            if (inMultiLineConsoleLog) {
                consoleLogLines.push(line);
                
                // Verificar si esta línea cierra el console.log
                if (trimmedLine.includes(')') && this.isConsoleLogComplete(consoleLogLines.join('\n'))) {
                    inMultiLineConsoleLog = false;
                    this.totalConsoleLogs++;
                    
                    const fullConsoleLog = consoleLogLines.join('\n');
                    
                    // Regla 2: Si está dentro de catch, convertir a console.error
                    if (inCatchBlock) {
                        const errorLines = consoleLogLines.map(l => l.replace(/console\.log/g, 'console.error'));
                        result.push(...errorLines);
                        this.convertedToError++;
                    }
                    // Regla 3: Verificar si borrar dejaría un bloque vacío
                    else if (this.wouldLeaveEmptyBlock(lines, i - consoleLogLines.length + 1)) {
                        result.push(...consoleLogLines);
                        this.preservedEmptyBlocks++;
                    }
                    // Regla 1: Borrar console.log normal
                    else {
                        console.log(`  Eliminado: ${fullConsoleLog.substring(0, 50)}...`);
                    }
                    
                    consoleLogLines = [];
                    continue;
                }
                
                // Si aún no se ha cerrado el console.log, continuar recopilando
                continue;
            }

            // Procesar console.log de una sola línea
            if (this.isConsoleLogLine(trimmedLine)) {
                this.totalConsoleLogs++;
                
                // Regla 2: Si está dentro de catch, convertir a console.error
                if (inCatchBlock) {
                    const errorLine = line.replace(/console\.log/g, 'console.error');
                    result.push(errorLine);
                    this.convertedToError++;
                    continue;
                }

                // Regla 3: Verificar si borrar dejaría un bloque vacío
                if (this.wouldLeaveEmptyBlock(lines, i)) {
                    result.push(line);
                    this.preservedEmptyBlocks++;
                    continue;
                }

                // Regla 1: Borrar console.log normal
                continue;
            }

            result.push(line);
        }

        return result;
    }

    /**
     * Verifica si una línea contiene console.log
     */
    isConsoleLogLine(line) {
        return /console\.log\(/.test(line) && !line.includes('//') && !line.includes('* console.log');
    }

    /**
     * Verifica si una línea inicia un console.log
     */
    isConsoleLogStart(line) {
        return /console\.log\(/.test(line) && !line.includes('//') && !line.includes('* console.log');
    }

    /**
     * Verifica si un bloque de texto contiene un console.log completo
     */
    isConsoleLogComplete(text) {
        // Contar paréntesis abiertos y cerrados
        let openParens = 0;
        let closeParens = 0;
        
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '(') openParens++;
            if (text[i] === ')') closeParens++;
        }
        
        return openParens === closeParens;
    }

    /**
     * Obtiene la profundidad de llaves en una posición específica
     */
    getBraceDepth(lines, startIndex) {
        let depth = 0;
        for (let i = 0; i <= startIndex; i++) {
            const line = lines[i];
            depth += (line.match(/{/g) || []).length;
            depth -= (line.match(/}/g) || []).length;
        }
        return depth;
    }

    /**
     * Verifica si es el final de un bloque catch
     */
    isEndOfCatchBlock(lines, currentIndex, catchDepth) {
        let depth = 0;
        for (let i = 0; i <= currentIndex; i++) {
            const line = lines[i];
            depth += (line.match(/{/g) || []).length;
            depth -= (line.match(/}/g) || []).length;
        }
        return depth < catchDepth;
    }

    /**
     * Verifica si borrar la línea dejaría un bloque vacío
     */
    wouldLeaveEmptyBlock(lines, consoleLogIndex) {
        // Verificar línea anterior
        const prevLine = lines[consoleLogIndex - 1] ? lines[consoleLogIndex - 1].trim() : '';
        const nextLine = lines[consoleLogIndex + 1] ? lines[consoleLogIndex + 1].trim() : '';

        // Si la línea anterior abre un bloque y la siguiente lo cierra
        if (prevLine.endsWith('{') && nextLine === '}') {
            return true;
        }

        // Si está dentro de un bloque try-catch-finally simple
        if (prevLine.includes('try {') && nextLine.includes('} catch') || 
            prevLine.includes('catch {') && nextLine.includes('} finally') ||
            prevLine.includes('finally {') && nextLine === '}') {
            return true;
        }

        return false;
    }

    /**
     * Encuentra todos los archivos JavaScript en un directorio
     */
    findJsFiles(dirPath) {
        const jsFiles = [];
        
        function traverseDirectory(currentPath) {
            const items = fs.readdirSync(currentPath);
            
            for (const item of items) {
                const fullPath = path.join(currentPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    // Excluir node_modules y .git
                    if (item !== 'node_modules' && item !== '.git') {
                        traverseDirectory(fullPath);
                    }
                } else if (item.endsWith('.js') && !item.endsWith('.test.js')) {
                    jsFiles.push(fullPath);
                }
            }
        }
        
        traverseDirectory(dirPath);
        return jsFiles;
    }

    /**
     * Ejecuta el proceso completo
     */
    run(directory = '.') {
        const jsFiles = this.findJsFiles(directory);
        
        
        for (const file of jsFiles) {
            this.processFile(file);
        }
        
        this.printSummary();
    }

    /**
     * Muestra el resumen de cambios
     */
    printSummary() {
    }
}

// Ejecución principal
if (require.main === module) {
    const remover = new ConsoleLogRemover();
    const targetDir = process.argv[2] || '.';
    
    
    remover.run(targetDir);
}

module.exports = ConsoleLogRemover;