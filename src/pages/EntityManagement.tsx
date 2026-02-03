import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PAGE_KEYS } from '@/types/auth';
import { LeaguesTab } from '@/components/entities/LeaguesTab';
import { TeamsTab } from '@/components/entities/TeamsTab';
import { BookmakersTab } from '@/components/entities/BookmakersTab';
import { useMemo } from 'react';

type TabConfig = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pageKey: typeof PAGE_KEYS.LEAGUES | typeof PAGE_KEYS.TEAMS | typeof PAGE_KEYS.BOOKMAKERS;
};

const ALL_TABS: TabConfig[] = [
  { id: 'leagues', label: 'Ligas', icon: Trophy, pageKey: PAGE_KEYS.LEAGUES },
  { id: 'teams', label: 'Times', icon: Users, pageKey: PAGE_KEYS.TEAMS },
  { id: 'bookmakers', label: 'Casas de Apostas', icon: Building2, pageKey: PAGE_KEYS.BOOKMAKERS },
];

const EntityManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canViewPage } = useAuth();

  // Filtrar abas baseado em permissões
  const availableTabs = useMemo(() => 
    ALL_TABS.filter(tab => canViewPage(tab.pageKey)),
    [canViewPage]
  );

  // Obter aba ativa da URL ou usar a primeira disponível
  const urlTab = searchParams.get('tab');
  const defaultTab = availableTabs[0]?.id || 'leagues';
  const activeTab = availableTabs.some(t => t.id === urlTab) ? urlTab! : defaultTab;

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  if (availableTabs.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cadastros</h1>
          <p className="text-muted-foreground">Gerencie ligas, times e casas de apostas</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            {availableTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="leagues" className="mt-6">
            <LeaguesTab />
          </TabsContent>
          <TabsContent value="teams" className="mt-6">
            <TeamsTab />
          </TabsContent>
          <TabsContent value="bookmakers" className="mt-6">
            <BookmakersTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default EntityManagement;
