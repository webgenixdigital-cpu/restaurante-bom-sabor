'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginAdmin() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) { setErro('E-mail ou senha inválidos.'); return; }
    router.push('/admin/pedidos');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink">
      <form onSubmit={entrar} className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-xl font-bold text-green-dark mb-1">Bom Sabor — Admin</h1>
        <p className="text-sm text-ink/50 mb-6">Entre para gerenciar cardápio e pedidos.</p>
        <input
          className="w-full mb-3 px-4 py-3 rounded-xl border" placeholder="E-mail"
          value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
        />
        <input
          className="w-full mb-3 px-4 py-3 rounded-xl border" placeholder="Senha"
          value={senha} onChange={(e) => setSenha(e.target.value)} type="password" required
        />
        {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}
        <button disabled={carregando} className="w-full bg-green text-white font-bold py-3 rounded-xl disabled:opacity-50">
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
