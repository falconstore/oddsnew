import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useBulkCreateProcedures } from '@/hooks/useProcedures';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  message: string;
}

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const bulkCreate = useBulkCreateProcedures();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setResult(null);
  };

  const detectSeparator = (line: string): string => {
    const separators = ['\t', ',', ';'];
    let maxCount = 0;
    let bestSeparator = '\t';
    
    separators.forEach(sep => {
      const count = line.split(sep).length;
      if (count > maxCount) {
        maxCount = count;
        bestSeparator = sep;
      }
    });
    
    return bestSeparator;
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const separator = detectSeparator(lines[0]);
    const headers = lines[0].split(separator).map(h => h.trim());
    
    const columnMap: Record<string, string> = {
      'Data': 'date',
      'Plataforma': 'platform',
      'Nome Promoção': 'promotion_name',
      'Categoria': 'category',
      'Status': 'status',
      'Ref Freebet': 'freebet_reference',
      'PROC': 'procedure_number',
      'Valor Freebet': 'freebet_value',
      'Valor Final': 'profit_loss',
      'Link': 'telegram_link',
      'Bets': 'platform'
    };

    const records: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim());
      
      const rawRecord: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (values[index] && values[index] !== '') {
          rawRecord[header] = values[index];
        }
      });

      const record: Record<string, string> = {};
      Object.keys(rawRecord).forEach(key => {
        const mappedKey = columnMap[key];
        if (mappedKey) {
          record[mappedKey] = rawRecord[key];
        }
      });

      if (!record.date || !record.platform || !record.procedure_number) {
        continue;
      }

      const cleanRecord: any = {
        date: null,
        procedure_number: null,
        platform: null,
        promotion_name: null,
        category: 'Promoção',
        status: 'Finalizado',
        freebet_reference: null,
        freebet_value: null,
        profit_loss: 0,
        telegram_link: null,
        dp: false,
        tags: [],
        is_favorite: false
      };

      // Data - Converter DD/MM/YYYY para YYYY-MM-DD
      if (record.date.includes('/')) {
        const [day, month, year] = record.date.split('/');
        cleanRecord.date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        cleanRecord.date = record.date;
      }

      cleanRecord.procedure_number = record.procedure_number;
      cleanRecord.platform = record.platform;
      
      if (record.category) cleanRecord.category = record.category;
      if (record.status) cleanRecord.status = record.status;

      if (record.profit_loss) {
        const cleanValue = record.profit_loss
          .replace(/R\$/g, '')
          .replace(/\s/g, '')
          .replace(',', '.');
        cleanRecord.profit_loss = parseFloat(cleanValue) || 0;
      }

      if (record.promotion_name) cleanRecord.promotion_name = record.promotion_name;
      if (record.freebet_reference) cleanRecord.freebet_reference = record.freebet_reference;

      if (record.freebet_value) {
        const cleanValue = record.freebet_value
          .replace(/R\$/g, '')
          .replace(/\s/g, '')
          .replace(',', '.');
        const parsedValue = parseFloat(cleanValue);
        if (!isNaN(parsedValue) && parsedValue > 0) {
          cleanRecord.freebet_value = parsedValue;
        }
      }

      if (record.telegram_link) cleanRecord.telegram_link = record.telegram_link;

      records.push(cleanRecord);
    }

    return records;
  };

  const handleImport = async () => {
    if (!file) {
      setResult({
        success: false,
        message: 'Selecione um arquivo CSV'
      });
      return;
    }

    setResult(null);

    try {
      const text = await file.text();
      const records = parseCSV(text);

      if (records.length === 0) {
        setResult({
          success: false,
          message: 'Nenhum dado válido encontrado. Verifique se o CSV possui Data, PROC e Plataforma.'
        });
        return;
      }

      await bulkCreate.mutateAsync(records);

      setResult({
        success: true,
        message: `${records.length} procedimentos importados com sucesso!`
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error: any) {
      setResult({
        success: false,
        message: `Erro ao importar: ${error.message}`
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Importar Procedimentos CSV</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              O CSV deve conter as seguintes colunas:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 mb-4">
              <li>• <strong className="text-foreground">Data</strong> (DD/MM/YYYY)</li>
              <li>• <strong className="text-foreground">PROC</strong> (número do procedimento)</li>
              <li>• <strong className="text-foreground">Plataforma</strong> (nome da casa de apostas)</li>
              <li>• <strong className="text-foreground">Valor Final</strong> (lucro/prejuízo em R$)</li>
            </ul>
            <p className="text-xs text-muted-foreground mb-2">Colunas opcionais:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Nome Promoção, Categoria, Status</li>
              <li>• Valor Freebet, Ref Freebet, Link</li>
            </ul>
          </div>

          <div>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
          </div>

          {result && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              result.success 
                ? 'bg-success/10 border border-success/30' 
                : 'bg-destructive/10 border border-destructive/30'
            }`}>
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${result.success ? 'text-success' : 'text-destructive'}`}>
                {result.message}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={bulkCreate.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              className="flex-1"
              disabled={bulkCreate.isPending || !file}
            >
              {bulkCreate.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
