const BASE = process.env.PAGBANK_API_URL || 'https://sandbox.api.pagseguro.com';

// Chamada à API do PagBank. Nunca lança erro: devolve sempre status e corpo.
export async function pagbankFetch(path: string, init?: RequestInit) {
  try {
    const resp = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.PAGBANK_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const texto = await resp.text();
    let corpo: any = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      corpo = { raw: texto };
    }
    return { ok: resp.ok, status: resp.status, corpo };
  } catch (e: any) {
    return { ok: false, status: 0, corpo: { error: String(e?.message || e) } };
  }
}