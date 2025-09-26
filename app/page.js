'use client';

import { useEffect, useMemo, useState } from 'react';

const ASSET_DECIMALS = {
  btc: 8,
  eth: 18,
  sol: 9
};

function humanAmount(asset, raw) {
  if (!raw) return '';
  const a = (asset || '').toLowerCase();
  const d = ASSET_DECIMALS[a] ?? 6; // 兜底
  try {
    const n = BigInt(raw);
    const int = n / BigInt(10 ** d);
    const frac = (n % BigInt(10 ** d)).toString().padStart(d, '0').replace(/0+$/, '');
    return frac ? `${int}.${frac}` : `${int}`;
  } catch {
    return raw;
  }
}

function badge(color, text) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: color,
        color: '#fff',
        fontSize: 12,
        lineHeight: '16px',
        marginRight: 6
      }}
    >
      {text}
    </span>
  );
}

const STATE_COLOR = {
  sourceTxDiscovered: '#6b7280',
  waitForSrcTxFinalization: '#0891b2',
  buildingDstTx: '#7c3aed',
  signTx: '#7c3aed',
  broadcastTx: '#2563eb',
  waitForDstTxFinalization: '#0ea5e9',
  readyForWithdrawQueue: '#a16207',
  queuedForWithdraw: '#a16207',
  done: '#16a34a',
  failure: '#dc2626'
};

function useQueryParams() {
  const [q, setQ] = useState(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''));
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp);
  }, []);
  return q;
}

export default function Page() {
  const q = useQueryParams();
  const [address, setAddress] = useState(q.get('address') || '');
  const [network, setNetwork] = useState(q.get('network') || 'mainnet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // 同步 URL，方便分享链接
  useEffect(() => {
    const sp = new URLSearchParams();
    if (address) sp.set('address', address);
    if (network) sp.set('network', network);
    const newUrl = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [address, network]);

  const ops = useMemo(() => {
    if (!data?.operations) return [];
    // 按 opCreatedAt 倒序
    return [...data.operations].sort((a, b) => {
      const ta = Date.parse(a.opCreatedAt || 0);
      const tb = Date.parse(b.opCreatedAt || 0);
      return tb - ta;
    });
  }, [data]);

  async function fetchOps() {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/operations?address=${encodeURIComponent(address)}&network=${encodeURIComponent(network)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
      } else {
        setData(json);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // 如果 URL 自带了 address，自动加载一次
  useEffect(() => {
    if (address) fetchOps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: '0 16px', fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Unit Operations Viewer</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        输入 Hyperliquid / EVM 地址，查询该地址相关的 Deposit / Withdraw 操作（数据来源：Hyperunit API）。
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="例如：0xa6f1Ef42D335Ec7CbfC39f57269c851568300132"
          style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}
        />
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}
        >
          <option value="mainnet">Mainnet</option>
          <option value="testnet">Testnet</option>
        </select>
        <button
          onClick={fetchOps}
          disabled={!address || loading}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            background: '#111827',
            color: '#fff',
            cursor: 'pointer',
            opacity: !address || loading ? 0.6 : 1
          }}
        >
          {loading ? '查询中…' : '查询'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {data?.addresses?.length > 0 && (
        <div style={{ marginBottom: 16, fontSize: 14, color: '#374151' }}>
          <div style={{ marginBottom: 6 }}><strong>相关协议地址（protocol addresses）</strong></div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.addresses.map((a, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                [{a.sourceCoinType} → {a.destinationChain}]: <code>{a.address}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {ops.map((op, idx) => {
          const color = STATE_COLOR[op.state] || '#4b5563';
          return (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div>
                  {badge('#111827', op.asset?.toUpperCase() || 'ASSET')}
                  {badge('#4b5563', `${op.sourceChain} → ${op.destinationChain}`)}
                  {badge(color, op.state)}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {op.opCreatedAt ? new Date(op.opCreatedAt).toLocaleString() : ''}
                </div>
              </div>

              <div style={{ marginTop: 8, fontSize: 14, color: '#111827' }}>
                <div><strong>金额</strong>：{humanAmount(op.asset, op.sourceAmount)} {op.asset?.toUpperCase()}</div>
                {!!op.destinationFeeAmount && <div>目的链费用：{humanAmount(op.asset, op.destinationFeeAmount)}</div>}
                {!!op.sweepFeeAmount && <div>Sweep 费用：{op.sweepFeeAmount}</div>}
                <div style={{ marginTop: 6, color: '#374151' }}>
                  <div>来源地址：<code>{op.sourceAddress}</code></div>
                  <div>目的地址：<code>{op.destinationAddress || '-'}</code></div>
                  <div>协议地址：<code>{op.protocolAddress}</code></div>
                </div>
                <div style={{ marginTop: 6, color: '#374151' }}>
                  <div>源链 Tx：<code>{op.sourceTxHash}</code></div>
                  <div>目的链 Tx：<code>{op.destinationTxHash || '-'}</code></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && ops.length === 0 && address && !error && (
        <div style={{ color: '#6b7280', marginTop: 12 }}>没有找到相关操作。</div>
      )}
    </main>
  );
}
