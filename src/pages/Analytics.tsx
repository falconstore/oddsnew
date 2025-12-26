import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

const Analytics = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Visualização de dados e tendências</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Os gráficos aparecerão aqui quando houver dados de odds históricos no banco.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Analytics;
