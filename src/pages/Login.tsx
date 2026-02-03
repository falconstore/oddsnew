import { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, AlertCircle, Clock } from 'lucide-react';

// Lazy load 3D background for performance
const LoginBackground3D = lazy(() => import('@/components/login/LoginBackground3D'));

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signOut, user, isApproved, userStatus, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (user && isApproved) {
      navigate(from, { replace: true });
    }
  }, [user, isApproved, navigate, from]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Email ou senha inválidos.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu email antes de fazer login.');
      } else {
        setError(error.message);
      }
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    // Validações
    if (!fullName.trim()) {
      setError('Por favor, informe seu nome completo.');
      setLoading(false);
      return;
    }

    if (!phone.trim()) {
      setError('Por favor, informe seu telefone.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName.trim(), phone.trim());
    
    if (error) {
      if (error.message.includes('User already registered')) {
        setError('Este email já está cadastrado. Tente fazer login.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('Cadastro realizado! Verifique seu email e aguarde a aprovação do administrador.');
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
    }
    
    setLoading(false);
  };

  // Mostrar loading enquanto carrega dados do usuário
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Se usuário está logado mas pendente/rejeitado (só mostra depois do loading)
  if (user && !isApproved) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        {/* 3D Background */}
        <Suspense fallback={<div className="absolute inset-0 bg-[#0a0a0f]" />}>
          <LoginBackground3D />
        </Suspense>
        
        {/* Overlay for readability */}
        <div className="absolute inset-0 z-10 bg-[#0a0a0f]/60 backdrop-blur-sm" />
        
        {/* Content */}
        <div className="relative z-20 min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card/20 backdrop-blur-xl border border-primary/20 shadow-2xl shadow-primary/10">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-primary/20 p-3 rounded-full border border-primary/30">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-foreground">
                {userStatus === 'pending' ? 'Aguardando Aprovação' : 'Acesso Negado'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {userStatus === 'pending' 
                  ? 'Seu cadastro está em análise. Você receberá acesso assim que um administrador aprovar sua conta.'
                  : 'Seu cadastro foi rejeitado. Entre em contato com o administrador para mais informações.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full border-primary/30 hover:bg-primary/10" 
                onClick={async () => {
                  await signOut();
                }}
              >
                Sair
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (user && isApproved) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 3D Background */}
      <Suspense fallback={<div className="absolute inset-0 bg-[#0a0a0f]" />}>
        <LoginBackground3D />
      </Suspense>
      
      {/* Overlay for readability */}
      <div className="absolute inset-0 z-10 bg-[#0a0a0f]/50 backdrop-blur-[2px]" />
      
      {/* Content */}
      <div className="relative z-20 min-h-screen flex items-center justify-center p-3 sm:p-4">
        <Card className="w-full max-w-md bg-card/15 backdrop-blur-xl border border-primary/20 shadow-2xl shadow-primary/10">
          <CardHeader className="text-center px-4 sm:px-6">
            <div className="flex justify-center mb-2 sm:mb-4">
              <div className="bg-primary/20 p-2 sm:p-3 rounded-full border border-primary/30 shadow-lg shadow-primary/20">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl text-foreground">BetShark Pro</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Faça login para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 bg-primary/10 border-primary/30">
                <AlertDescription className="text-primary">{success}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-background/30 backdrop-blur-sm">
                <TabsTrigger value="login" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Cadastro
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-foreground">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      disabled={loading}
                      className="bg-background/30 border-border/50 focus:border-primary/50 backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-foreground">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      className="bg-background/30 border-border/50 focus:border-primary/50 backdrop-blur-sm"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" 
                    disabled={loading}
                  >
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullname" className="text-foreground">Nome Completo</Label>
                    <Input
                      id="signup-fullname"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                      required
                      disabled={loading}
                      className="bg-background/30 border-border/50 focus:border-primary/50 backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone" className="text-foreground">Telefone</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      required
                      disabled={loading}
                      className="bg-background/30 border-border/50 focus:border-primary/50 backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-foreground">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      disabled={loading}
                      className="bg-background/30 border-border/50 focus:border-primary/50 backdrop-blur-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-foreground">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      className="bg-background/30 border-border/50 focus:border-primary/50 backdrop-blur-sm"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" 
                    disabled={loading}
                  >
                    {loading ? 'Cadastrando...' : 'Criar conta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
