import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/LogoutButton';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-ink text-white px-5 py-3 flex items-center justify-between">
        <span className="font-bold">Bom Sabor — Admin</span>
        <nav className="flex gap-4 text-sm items-center">
          <Link href="/admin/pedidos" className="opacity-80 hover:opacity-100">Pedidos</Link>
          <Link href="/admin/estoque" className="opacity-80 hover:opacity-100">Cardápio do dia</Link>
        
<a            href="https://portal.ifood.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            🛵 Abrir iFood
          </a>
          <LogoutButton />
        </nav>
      </header>
      <main className="p-5">{children}</main>
    </div>
  );
}