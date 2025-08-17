const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function killPort(port) {
  try {
    console.log(`\nОчистка порта ${port}...`);
    
    // Найти процесс на порту
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    
    if (!stdout.trim()) {
      console.log(`Порт ${port} свободен`);
      return;
    }
    
    // Извлечь PID из вывода netstat
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(pid);
        }
      }
    });
    
    // Убить каждый процесс
    for (const pid of pids) {
      try {
        await execAsync(`taskkill //PID ${pid} //F`);
        console.log(`Процесс ${pid} остановлен`);
      } catch (error) {
        console.log(`Не удалось остановить процесс ${pid}: ${error.message}`);
      }
    }
    
    console.log(`Порт ${port} освобожден\n`);
    
  } catch (error) {
    console.log(`Ошибка при очистке порта ${port}: ${error.message}`);
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  const port = process.argv[2] || 3010;
  killPort(port);
}

module.exports = { killPort };