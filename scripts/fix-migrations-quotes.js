const fs = require('fs');
const path = require('path');

// Function to fix the migration format
function fixMigrationFormat(content) {
    // Convert from template literals with escaped backticks to regular strings
    // Using a safer approach with temporary markers
    
    // Step 1: Replace escaped backticks with temporary marker
    let fixedContent = content.replace(/\\`/g, '@@bat@@');
    
    // Step 2: Escape double quotes inside the SQL content
    // First, we need to capture the template literal content and escape quotes
    fixedContent = fixedContent.replace(/await queryRunner\.query\(`((?:[^`]|@@bat@@)+)`\)/g, (match, sqlContent) => {
        // Escape double quotes inside the SQL
        const escapedSql = sqlContent.replace(/"/g, '\\"');
        return `await queryRunner.query("${escapedSql}")`;
    });
    
    // Step 3: Replace temporary marker back to regular backticks
    fixedContent = fixedContent.replace(/@@bat@@/g, '`');
    
    return fixedContent;
}

// Function to process all migration files
function fixMigrations() {
    const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
        console.log(`Created migrations directory: ${migrationsDir}`);
        return; // No files to process if directory was just created
    }
    
    // Read all files in the migrations directory
    const files = fs.readdirSync(migrationsDir);
    
    const migrationFiles = files.filter(file => file.endsWith('.ts'));
    
    console.log(`Found ${migrationFiles.length} migration files to process`);
    
    migrationFiles.forEach(file => {
        const filePath = path.join(migrationsDir, file);
        console.log(`Processing: ${file}`);
        
        // Read the file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Fix the format
        const fixedContent = fixMigrationFormat(content);
        
        // Write the fixed content back to the file
        fs.writeFileSync(filePath, fixedContent, 'utf8');
        
        console.log(`Fixed: ${file}`);
    });
    
    console.log('Migration format fixing completed!');
}

// Run the script
if (require.main === module) {
    fixMigrations();
}

module.exports = { fixMigrationFormat, fixMigrations };