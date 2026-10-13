import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/components/ui';
import { HardHat } from 'lucide-react';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 dark:from-black dark:via-slate-900 dark:to-black">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
            <HardHat size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">FieldControl</h1>
          <p className="mt-1 text-sm text-slate-400">Controle de atividades de campo</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900 dark:shadow-slate-900/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="E-mail" type="email" value={email} onChange={setEmail} required placeholder="email@exemplo.com" />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={setPassword}
              required
              placeholder="••••••••"
              showPasswordToggle
            />

            {error && (
              <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Carregando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
