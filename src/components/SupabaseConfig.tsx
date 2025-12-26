import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateSupabaseConfig, isSupabaseConfigured, clearSupabaseConfig } from '@/lib/supabase';
import { Database, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

export function SupabaseConfig() {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const isConfigured = isSupabaseConfigured();

  const handleConnect = () => {
    if (url && anonKey) {
      updateSupabaseConfig(url, anonKey);
    }
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
  };

  if (isConfigured) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Supabase Conectado
          </CardTitle>
          <CardDescription>
            Seu banco de dados externo está configurado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleDisconnect}>
            Desconectar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Conectar Supabase Externo
        </CardTitle>
        <CardDescription>
          Configure a conexão com seu projeto Supabase. Você pode encontrar essas informações em Settings → API no seu dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="supabase-url">Project URL</Label>
          <Input
            id="supabase-url"
            placeholder="https://xxxxx.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supabase-key">Anon Key (public)</Label>
          <Input
            id="supabase-key"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleConnect} disabled={!url || !anonKey}>
            Conectar
          </Button>
          <Button variant="outline" asChild>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Supabase
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
