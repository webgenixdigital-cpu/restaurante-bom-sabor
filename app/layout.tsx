import './globals.css';

export const metadata = {
  title: 'Bom Sabor — Pedido Online',
  description: 'Monte sua marmita e faça seu pedido',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
