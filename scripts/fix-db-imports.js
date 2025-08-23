#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Функция для поиска всех файлов с неправильными импортами
function findFilesWithBadImports() {
  try {
    const command = 'grep -r --include="*.ts" --include="*.tsx" -l "from.*@/lib/db-connection" app/api/';
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return output.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    console.log('No files found with bad imports or error occurred:', error.message);
    return [];
  }
}

// Функция для исправления файла
function fixFile(filePath) {
  console.log(`Fixing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Заменяем импорт getPool
  if (content.includes("from '@/lib/db-connection'")) {
    // Заменяем импорт только getPool на pool
    content = content.replace(
      /import\s*{\s*getPool\s*}\s*from\s*['"]@\/lib\/db-connection['"];?/g,
      "import { pool } from '@/lib/db';"
    );
    
    // Заменяем комбинированные импорты
    content = content.replace(
      /import\s*{\s*([^}]*),?\s*getPool\s*([^}]*)\s*}\s*from\s*['"]@\/lib\/db-connection['"];?/g,
      (match, before, after) => {
        const imports = [];
        if (before.trim()) imports.push(before.trim());
        if (after.trim()) imports.push(after.trim());
        
        let result = '';
        if (imports.length > 0) {
          result += `import { ${imports.join(', ')} } from '@/lib/db-connection';\n`;
        }
        result += "import { pool } from '@/lib/db';";
        return result;
      }
    );
    
    // Заменяем использование getPool() на pool
    content = content.replace(/const\s+pool\s*=\s*getPool\(\);?/g, '// Use imported pool instance');
    content = content.replace(/getPool\(\)/g, 'pool');
    
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath}`);
  } else {
    console.log(`⚪ No changes needed: ${filePath}`);
  }
}

// Основная функция
function main() {
  console.log('🔧 Fixing database imports...\n');
  
  const files = findFilesWithBadImports();
  
  if (files.length === 0) {
    console.log('✅ No files need fixing!');
    return;
  }
  
  console.log(`Found ${files.length} files to fix:`);
  files.forEach(file => console.log(`  - ${file}`));
  console.log();
  
  files.forEach(fixFile);
  
  console.log(`\n🎉 Completed! Fixed ${files.length} files.`);
}

if (require.main === module) {
  main();
}

module.exports = { fixFile, findFilesWithBadImports };