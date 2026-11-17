// Cliente da API do Asaas — SOMENTE no servidor
export async function asaas<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const base = process.env.ASAAS_API_URL;
  const key = process.env.ASAAS_API_KEY;
  if (!base || !key) throw new Error('Asaas não configurado (ASAAS_API_URL / ASAAS_API_KEY).');

  const res = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'CantinaBomSabor/1.0', access_token: key },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const texto = await res.text();
  const json = texto ? JSON.parse(texto) : {};
  if (!res.ok) {
    const msg = (json?.errors || []).map((e: any) => e.description).join(' ') || `Erro ${res.status} no Asaas`;
    throw new Error(msg);
  }
  return json as T;
}