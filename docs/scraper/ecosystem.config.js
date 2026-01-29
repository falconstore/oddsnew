/**
 * PM2 Ecosystem Configuration
 * 
 * Gerencia todos os processos de scraping de forma distribuída.
 * 
 * Comandos úteis:
 *   pm2 start ecosystem.config.js     # Iniciar todos
 *   pm2 status                         # Ver status
 *   pm2 monit                          # Monitor em tempo real
 *   pm2 logs scraper-betano            # Ver logs de um scraper
 *   pm2 restart scraper-novibet        # Reiniciar apenas um
 *   pm2 stop scraper-bet365            # Parar um scraper
 *   pm2 startup && pm2 save            # Auto-start no boot
 *   pm2 reload all                     # Reload suave
 */

module.exports = {
  apps: [
    // ============================================
    // SCRAPERS HTTPX (Leves - 30s interval)
    // Usam requests HTTP diretos, baixo consumo de memória
    // ============================================
    
    {
      name: 'scraper-betano',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper betano --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-superbet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper superbet --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-novibet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper novibet --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-kto',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper kto --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-estrelabet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper estrelabet --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-sportingbet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper sportingbet --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-betnacional',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper betnacional --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-stake',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper stake --interval 30',
      cwd: __dirname,
      max_memory_restart: '400M',
      restart_delay: 10000,
      max_restarts: 5,
      min_uptime: 30000,
      kill_timeout: 30000,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-br4bet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper br4bet --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-mcgames',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper mcgames --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-aposta1',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper aposta1 --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-esportivabet',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper esportivabet --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-jogodeouro',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper jogodeouro --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-tradeball',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper tradeball --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    
    // ============================================
    // SCRAPERS PLAYWRIGHT (Pesados - 45s interval)
    // Usam browser automatizado, maior consumo de memória
    // ============================================
    
    {
      name: 'scraper-bet365',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper bet365 --interval 45',
      cwd: __dirname,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 30,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-betbra',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper betbra --interval 45',
      cwd: __dirname,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 30,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    
    // ============================================
    // NBA-ONLY SCRAPERS (30s interval)
    // Scrapers de basquete separados
    // ============================================
    
    {
      name: 'scraper-betano-nba',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper betano_nba --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-betbra-nba',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper betbra_nba --interval 45',
      cwd: __dirname,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 30,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-br4bet-nba',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper br4bet_nba --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-mcgames-nba',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper mcgames_nba --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-aposta1-nba',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper aposta1_nba --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-esportivabet-nba',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper esportivabet_nba --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'scraper-jogodeouro-nba',
      script: 'standalone/run_scraper.py',
      interpreter: 'python3',
      args: '--scraper jogodeouro_nba --interval 30',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 3000,
      max_restarts: 50,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    
    // ============================================
    // SERVIÇOS AUXILIARES
    // ============================================
    
    {
      name: 'json-generator',
      script: 'standalone/run_json_generator.py',
      interpreter: 'python3',
      args: '--interval 15',
      cwd: __dirname,
      max_memory_restart: '100M',
      restart_delay: 2000,
      max_restarts: 100,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    {
      name: 'cleanup-service',
      script: 'standalone/run_cleanup.py',
      interpreter: 'python3',
      args: '--interval 300',
      cwd: __dirname,
      max_memory_restart: '50M',
      restart_delay: 5000,
      max_restarts: 100,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
  ],
};
