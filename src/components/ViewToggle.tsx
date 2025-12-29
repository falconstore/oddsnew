import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGrid, List, Target } from 'lucide-react';

export type ViewMode = 'cards' | 'compact' | 'surebets';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as ViewMode)}
      className="border rounded-lg p-1"
    >
      <ToggleGroupItem value="cards" aria-label="Visualização em cards" className="px-3">
        <LayoutGrid className="h-4 w-4 mr-2" />
        Cards
      </ToggleGroupItem>
      <ToggleGroupItem value="compact" aria-label="Tabela compacta" className="px-3">
        <List className="h-4 w-4 mr-2" />
        Tabela
      </ToggleGroupItem>
      <ToggleGroupItem value="surebets" aria-label="Apenas surebets" className="px-3">
        <Target className="h-4 w-4 mr-2" />
        Surebets
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
