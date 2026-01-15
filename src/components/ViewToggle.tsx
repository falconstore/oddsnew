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
      className="border rounded-lg p-0.5 sm:p-1"
    >
      <ToggleGroupItem value="cards" aria-label="Visualização em cards" className="px-2 sm:px-3 text-xs sm:text-sm h-8 sm:h-9">
        <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        <span className="hidden xs:inline sm:inline">Cards</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="compact" aria-label="Tabela compacta" className="px-2 sm:px-3 text-xs sm:text-sm h-8 sm:h-9">
        <List className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        <span className="hidden xs:inline sm:inline">Tabela</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="surebets" aria-label="Apenas surebets" className="px-2 sm:px-3 text-xs sm:text-sm h-8 sm:h-9">
        <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        <span className="hidden xs:inline sm:inline">Surebets</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
