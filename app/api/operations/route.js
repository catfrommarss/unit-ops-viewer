export const runtime = 'edge';

function pickBase(networkParam) {
  const envBase = process.env.UNIT_API_BASE; // 可选：在 Vercel 环境变量里覆盖
  if (envBase) return envBase;
  const n = (networkParam || 'mainnet').toLowerCase();
  return n === 'testnet'
    ? 'https://api.hyperunit-testnet.xyz'
    : 'https://api.hyperunit.xyz';
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const address = url.searchParams.get('address');
    const network = url.searchParams.get('network') || 'mainnet';
    if (!address) {
      return new Response(JSON.stringify({ error: 'address is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    const base = pickBase(network);
    const upstream = `${base}/operations/${address}`;
    const res = await fetch(upstream, {
      headers: { accept: 'application/json' },
      // 给上游一些缓存机会（不影响你刷新查询）
      cf: { cacheEverything: false }
    });

    // 直接透传状态码与数据
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 's-maxage=10, stale-while-revalidate=60'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
