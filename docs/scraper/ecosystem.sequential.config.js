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
    // RUNNER SEQUENCIAL UNIFICADO - TODOS OS SCRAPERS
    // ============================================
    // Executa todos os scrapers em ordem intercalada:
    //   superbet -> novibet -> kto -> BETANO (pesado) ->
    //   estrelabet -> sportingbet -> betnacional -> BETBRA (pesado) ->
    //   br4bet -> mcgames -> jogodeouro -> STAKE (pesado) ->
    //   tradeball -> bet365 -> APOSTA1 (pesado) ->
    //   br4bet_nba -> mcgames_nba -> jogodeouro_nba -> ESPORTIVABET (pesado)
    // 
    // Tempo estimado por ciclo: ~8-10 minutos
    // Apenas 1 Chrome por vez!
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
      kill_timeout: 150000,  // 2.5 min para terminar scraper atual graciosamente
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
