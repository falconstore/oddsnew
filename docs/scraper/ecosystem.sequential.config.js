/**
 * PM2 Ecosystem Configuration - MODO SEQUENCIAL UNIFICADO
 * 
 * Executa TODOS os scrapers em 1 único processo, em sequência.
 * 
 * Benefícios:
 *   - Load máximo: ~2-4 (vs 11+ no modo paralelo)
 *   - Memória: ~400-600 MB (vs 2-3 GB)
 *   - Chrome simultâneos: 1 (apenas Stake usa 2 páginas internas)
 *   - Processos PM2: 3 (vs 18+)
 * 
 * Trade-off:
 *   - Freshness: ~8-10 min por ciclo completo (vs 30s-120s)
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
 *   pm2 status                      # Ver processos
 *   pm2 logs scraper-sequential     # Logs do runner unificado
 *   htop                            # Verificar CPU/memória
 */

module.exports = {
  apps: [
    // ============================================
    // RUNNER HÍBRIDO - PARES PARALELOS (RECOMENDADO)
    // ============================================
    // Executa scrapers em pares: 1 leve + 1 pesado simultaneamente
    // 
    // Benefícios vs sequencial:
    //   - Tempo de ciclo: ~120-150s (vs ~229s)
    //   - Load esperado: 3-5 (seguro para 8 vCPUs)
    //   - Máximo 1 Chrome pesado + 1 HTTPX leve por vez
    //
    // Pares:
    //   superbet+betano, novibet+betbra, kto+stake,
    //   estrelabet+aposta1, sportingbet+esportivabet,
    //   betnacional, br4bet+mcgames, jogodeouro+tradeball,
    //   bet365, br4bet_nba+mcgames_nba+jogodeouro_nba
    {
      name: 'scraper-hybrid',
      script: 'standalone/run_sequential.py',
      interpreter: 'python3',
      args: '--mode hybrid',
      cwd: __dirname,
      max_memory_restart: '700M',  // 2 scrapers simultâneos
      restart_delay: 10000,
      max_restarts: 10,
      min_uptime: 60000,
      kill_timeout: 150000,  // 2.5 min para terminar par atual graciosamente
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },

    // ============================================
    // RUNNER SEQUENCIAL (ALTERNATIVA CONSERVADORA)
    // ============================================
    // Descomente para usar em vez do híbrido se load ficar alto
    // Tempo de ciclo: ~229s | Load: ~1.5
    /*
    {
      name: 'scraper-sequential',
      script: 'standalone/run_sequential.py',
      interpreter: 'python3',
      args: '--mode all',
      cwd: __dirname,
      max_memory_restart: '600M',
      restart_delay: 10000,
      max_restarts: 10,
      min_uptime: 60000,
      kill_timeout: 150000,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
    */

    // ============================================
    // SERVIÇOS AUXILIARES
    // ============================================
    
    {
      name: 'json-generator',
      script: 'standalone/run_json_generator.py',
      interpreter: 'python3',
      args: '--interval 60',  // Aumentado para 60s (ciclo completo ~8-10 min)
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
      max_memory_restart: '100M',
      restart_delay: 5000,
      max_restarts: 100,
      autorestart: true,
      env: {
        PYTHONUNBUFFERED: '1'
      }
    },
  ],
};
