import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Columns } from 'lucide-react';
import { AVAILABLE_COLUMNS, ColumnKey } from '@/types/procedures';

interface ColumnCustomizerProps {
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  onClose: () => void;
}

export function ColumnCustomizer({ visibleColumns, onColumnsChange, onClose }: ColumnCustomizerProps) {
  const handleToggle = (columnKey: ColumnKey) => {
    const newColumns = visibleColumns.includes(columnKey)
      ? visibleColumns.filter(col => col !== columnKey)
      : [...visibleColumns, columnKey];
    
    onColumnsChange(newColumns);
    localStorage.setItem('procedureVisibleColumns', JSON.stringify(newColumns));
  };

  const handleReset = () => {
    const defaultColumns = AVAILABLE_COLUMNS.map(col => col.key);
    onColumnsChange(defaultColumns);
    localStorage.setItem('procedureVisibleColumns', JSON.stringify(defaultColumns));
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Columns className="w-5 h-5 text-primary" />
            <CardTitle>Personalizar Colunas</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {AVAILABLE_COLUMNS.map((column) => (
              <div key={column.key} className="flex items-center justify-between py-2">
                <Label htmlFor={column.key} className="cursor-pointer text-sm">
                  {column.label}
                </Label>
                <Switch
                  id={column.key}
                  checked={visibleColumns.includes(column.key)}
                  onCheckedChange={() => handleToggle(column.key)}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-3 pt-6 border-t border-border mt-6">
            <Button variant="outline" onClick={handleReset}>
              Restaurar Padrão
            </Button>
            <Button onClick={onClose}>
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
