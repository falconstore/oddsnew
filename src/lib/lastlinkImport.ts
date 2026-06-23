// Import do relatório de vendas da Lastlink (xlsx "sales_list_*").
//
// Lê o arquivo no navegador (SheetJS), mapeia as 44 colunas do relatório pro
// shape da tabela lastlink_sales, converte datas BR (DD/MM/YY HH:MM:SS) e
// valores numéricos, e faz UPSERT por id_venda (não duplica; atualiza status).
import * as XLSX from 'xlsx';
import { supabaseProcedures } from '@/lib/supabaseProcedures';

export interface LastlinkSaleRow {
  id_venda: string;
  status: string | null;
  data_venda: string | null;
  email: string | null;
  nome: string | null;
  telefone: string | null;
  documento: string | null;
  endereco: string | null;
  tipo_venda: string | null;
  produto: string | null;
  produtos_combo: string | null;
  produtos_bump: string | null;
  oferta: string | null;
  modalidade: string | null;
  forma_pagamento: string | null;
  parcelamento: string | null;
  cupom: string | null;
  valor: number | null;
  comissao_afiliado: number | null;
  comissao_coprod: number | null;
  taxa_lastlink: number | null;
  comissao_produtor: number | null;
  afiliado: string | null;
  coprodutores: string | null;
  data_pagamento: string | null;
  data_expiracao: string | null;
  data_reembolso: string | null;
  data_chargeback: string | null;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  motivo_falha: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  source_file: string;
}

export interface ImportResult {
  totalNoArquivo: number;
  enviados: number;     // linhas válidas enviadas ao banco
  ignorados: number;    // linhas sem id_venda
  erro?: string;
}

// "DD/MM/YY HH:MM:SS" ou "DD/MM/YYYY HH:MM:SS" → ISO (assume fuso de Brasília).
function parseBrDateTime(s: unknown): string | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  let y = +m[3];
  if (y < 100) y += 2000;
  const hh = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  // monta ISO com offset -03:00 (Brasília)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const iso = `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mi)}:${pad(ss)}-03:00`;
  const t = new Date(iso);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

// "247.00" / "116,1100" / "1.234,56" → number. Lida com formato BR e US.
function parseNum(s: unknown): number | null {
  if (s == null || s === '') return null;
  if (typeof s === 'number') return s;
  let str = String(s).trim();
  if (!str) return null;
  // Se tem vírgula como decimal (formato BR): remove pontos de milhar, troca vírgula por ponto
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

const txt = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** Lê o arquivo e devolve as linhas no shape da tabela (sem enviar ao banco). */
export async function parseLastlinkFile(file: File): Promise<LastlinkSaleRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // raw:false → valores como string (consistente com o que vimos no arquivo)
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: null });

  const G = (r: Record<string, unknown>, key: string) => r[key];

  return json
    .map((r): LastlinkSaleRow | null => {
      const id = txt(G(r, 'Identificador da venda'));
      if (!id) return null; // sem chave única, não dá pra deduplicar
      return {
        id_venda: id,
        status: txt(G(r, 'Status da venda')),
        data_venda: parseBrDateTime(G(r, 'Data da Venda')),
        email: txt(G(r, 'E-mail do membro')),
        nome: txt(G(r, 'Nome/Razão social do membro')),
        telefone: txt(G(r, 'Telefone do membro')),
        documento: txt(G(r, 'Documento do membro')),
        endereco: txt(G(r, 'Endereço do membro')),
        tipo_venda: txt(G(r, 'Tipo da venda')),
        produto: txt(G(r, 'Produto principal')),
        produtos_combo: txt(G(r, 'Produtos do combo')),
        produtos_bump: txt(G(r, 'Produtos do order bump')),
        oferta: txt(G(r, 'Nome da oferta')),
        modalidade: txt(G(r, 'Modalidade de cobrança')),
        forma_pagamento: txt(G(r, 'Forma de pagamento')),
        parcelamento: txt(G(r, 'Parcelamento')),
        cupom: txt(G(r, 'Cupom')),
        valor: parseNum(G(r, 'Valor da venda')),
        comissao_afiliado: parseNum(G(r, 'Comissão do afiliado')),
        comissao_coprod: parseNum(G(r, 'Comissão total de coprodutores')),
        taxa_lastlink: parseNum(G(r, 'Taxa de serviço Lastlink')),
        comissao_produtor: parseNum(G(r, 'Comissão do Produtor')),
        afiliado: txt(G(r, 'Afiliado')),
        coprodutores: txt(G(r, 'Coprodutores')),
        data_pagamento: parseBrDateTime(G(r, 'Data do pagamento')),
        data_expiracao: parseBrDateTime(G(r, 'Data da expiração')),
        data_reembolso: parseBrDateTime(G(r, 'Data do reembolso')),
        data_chargeback: parseBrDateTime(G(r, 'Data do chargeback')),
        data_cancelamento: parseBrDateTime(G(r, 'Data do cancelamento')),
        motivo_cancelamento: txt(G(r, 'Motivo do cancelamento')),
        motivo_falha: txt(G(r, 'Motivo de falha')),
        utm_source: txt(G(r, 'utm_source')),
        utm_medium: txt(G(r, 'utm_medium')),
        utm_campaign: txt(G(r, 'utm_campaign_name')),
        source_file: file.name,
      };
    })
    .filter((r): r is LastlinkSaleRow => r !== null);
}

/**
 * Importa o arquivo: parseia + upsert por id_venda em lotes.
 * Upsert garante que reenviar o mesmo arquivo NÃO duplica (atualiza status).
 */
export async function importLastlinkFile(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const rows = await parseLastlinkFile(file);
  const total = rows.length;
  if (total === 0) {
    return { totalNoArquivo: 0, enviados: 0, ignorados: 0, erro: 'Nenhuma venda válida encontrada no arquivo.' };
  }

  const BATCH = 500;
  let enviados = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabaseProcedures
      .from('lastlink_sales')
      .upsert(batch, { onConflict: 'id_venda' });
    if (error) {
      return { totalNoArquivo: total, enviados, ignorados: 0, erro: error.message };
    }
    enviados += batch.length;
    onProgress?.(enviados, total);
  }

  return { totalNoArquivo: total, enviados, ignorados: 0 };
}
