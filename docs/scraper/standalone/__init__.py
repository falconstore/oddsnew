"""
Standalone Scripts - Scripts para execução isolada via PM2.

Este pacote contém os runners standalone para arquitetura distribuída:

- run_scraper.py: Runner genérico para qualquer scraper
- run_json_generator.py: Serviço de geração de JSON
- run_cleanup.py: Serviço de limpeza de matches antigos
- shared_resources.py: Recursos compartilhados (caches)
- normalizer.py: Normalização e inserção de odds

Uso com PM2:
    pm2 start ecosystem.config.js
"""

from .shared_resources import SharedResources, get_shared_resources
from .normalizer import OddsNormalizer

__all__ = [
    "SharedResources",
    "get_shared_resources",
    "OddsNormalizer",
]
