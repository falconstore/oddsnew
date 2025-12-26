import { Layout } from '@/components/Layout';
import { SupabaseConfig } from '@/components/SupabaseConfig';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie a conexão com seu banco de dados</p>
        </div>
        <div className="max-w-xl">
          <SupabaseConfig />
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
