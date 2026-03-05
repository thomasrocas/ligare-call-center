import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-white p-8 shadow-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-brand-900">Ligare Call Center</h1>
            <p className="mt-2 text-zinc-500">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@ligare.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-zinc-400 text-center">
              Demo: owner@ligare.com / password123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
