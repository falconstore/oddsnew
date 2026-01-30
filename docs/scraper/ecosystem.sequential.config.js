/**
 * PM2 Ecosystem Configuration - MODO SEQUENCIAL
 * 
 * Executa scrapers em sequência (um após o outro) para reduzir carga no servidor.
 * 
 * Benefícios:
 *   - Load máximo: ~2-4 (vs 11+ no modo paralelo)
 *   - Memória: ~400-600 MB (vs 2-3 GB)
 *   - Chrome simultâneos: 1 (vs 2-5)
 *   - Processos PM2: 4 (vs 18+)
 * 
 * Trade-off:
 *   - Freshness: ~5-8 min por ciclo completo (vs 30s-120s)
 * 
 * COMO USAR:
 * 
 *   # Ativar modo SEQUENCIAL:
 *   pm2 stop all
 *   pm2 delete all
 *   pm2 start ecosystem.sequential.config.js
 *   pm2 save
 * 
 *   # ROLLBACK para modo PARALELO:
 *   pm2 stop all
 *   pm2 delete all
 *   pm2 start ecosystem.config.js
 *   pm2 save
 * 
 * MONITORAMENTO:
 *   pm2 status                    # Ver processos
 *   pm2 logs scraper-seq-light    # Logs do runner leve
 *   pm2 logs scraper-seq-heavy    # Logs do runner pesado
 *   htop                          # Verificar CPU/memória
 */

module.exports = {
  apps: [
    // ============================================
    // RUNNER SEQUENCIAL - SCRAPERS LEVES (HTTPX)
    // ============================================
    // Executa: superbet, novibet, kto, estrelabet, sportingbet,
    //          betnacional, br4bet, mcgames, jogodeouro, tradeball,
    //          bet365, br4bet_nba, mcgames_nba, jogodeouro_nba
    // Tempo estimado por ciclo: ~2-3 minutos
    {
      name: 'scraper-seq-light',
      script: 'standalone/run_sequential.py',
      interpreter: 'python3',
      args: '--mode light',
      cwd: __dirname,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 50,
      min_uptime: 30000,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },

    // ============================================
    // RUNNER SEQUENCIAL - SCRAPERS PESADOS (Playwright)
    // ============================================
    // Executa: betano, betbra, stake, aposta1, esportivabet
    // Tempo estimado por ciclo: ~5-6 minutos
    // Apenas 1 Chrome por vez!
    {
      name: 'scraper-seq-heavy',
      script: 'standalone/run_sequential.py',
      interpreter: 'python3',
      args: '--mode heavy',
      cwd: __dirname,
      max_memory_restart: '500M',
      restart_delay: 10000,
      max_restarts: 10,
      min_uptime: 60000,
      kill_timeout: 150000,  // 2.5 min para terminar scraper atual graciosamente
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },

    // ============================================
    // SERVIÇOS AUXILIARES (mantidos do modo paralelo)
    // ============================================
    
    {
      name: 'json-generator',
      script: 'standalone/run_json_generator.py',
      interpreter: 'python3',
      args: '--interval 30',  // Aumentado de 15s para 30s
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
