
# Plano de Correção: Erro asyncio.CancelledError no Aposta1 Unified

## Diagnóstico do Problema

O scraper Aposta1 está falhando com `asyncio.CancelledError` porque:

1. **Tempo de execução > Intervalo configurado**
   - Token Playwright: ~30s
   - 14 ligas de futebol: ~40s  
   - NBA: ~5s
   - **Total: ~75s** vs **Intervalo PM2: 60s**
   
2. PM2 inicia novo ciclo enquanto o anterior não terminou, causando cancelamento

3. Memória de 150M pode ser insuficiente durante picos de requisições paralelas

---

## Correções Propostas

### 1. Aumentar Intervalo PM2 (120s)

Alterar `ecosystem.config.js`:
```javascript
// scraper-aposta1
args: '--scraper aposta1 --interval 120',  // era 60
max_memory_restart: '200M',  // era 150M
```

### 2. Proteger Requisições Contra Cancelamento

Adicionar tratamento de `asyncio.CancelledError` em pontos críticos do `aposta1_unified_scraper.py`:

```python
async def _fetch_all_event_details(self, event_ids: List[str]) -> Dict[str, Dict]:
    results = {}
    batch_size = 5
    
    for i in range(0, len(event_ids), batch_size):
        batch = event_ids[i:i + batch_size]
        
        try:
            tasks = [self._fetch_event_details(eid) for eid in batch]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            for eid, resp in zip(batch, responses):
                if isinstance(resp, dict):
                    results[eid] = resp
            
            if i + batch_size < len(event_ids):
                await asyncio.sleep(0.2)
                
        except asyncio.CancelledError:
            self.logger.warning(f"[Aposta1] Batch cancelado, retornando {len(results)} resultados parciais")
            break  # Retorna o que temos até agora
    
    return results
```

### 3. Aplicar Mesma Correção ao Esportivabet

Por consistência, aplicar a mesma proteção ao `esportivabet_unified_scraper.py`.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `docs/scraper/ecosystem.config.js` | Aumentar intervalo para 120s, memória para 200M |
| `docs/scraper/scrapers/aposta1_unified_scraper.py` | Adicionar proteção contra CancelledError |
| `docs/scraper/scrapers/esportivabet_unified_scraper.py` | Adicionar proteção contra CancelledError |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tempo para completar ciclo | ~75s | ~75s |
| Intervalo PM2 | 60s | 120s |
| Folga para execução | -15s (negativo!) | +45s |
| Erros CancelledError | Frequentes | Eliminados |

---

## Comandos Pós-Implementação

```bash
# Na VPS
pm2 restart scraper-aposta1 scraper-esportivabet
pm2 logs scraper-aposta1 --lines 50
```
