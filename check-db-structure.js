require('dotenv').config({ path: '.env.local' });
const { executeQuery } = require('./lib/database/db-connection.ts');

async function checkStructure() {
  try {
    // Проверяем колонки в таблице product_variants
    const result = await executeQuery(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_variants' 
      ORDER BY ordinal_position;
    `, []);
    
    console.log('Columns in product_variants table:');
    result.rows.forEach(row => {
      console.log(`${row.column_name} - ${row.data_type}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkStructure();