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
  const d = ASSET_DECIMALS[a] ?? 6;
  try {
    const n = BigInt(raw);
    const base = BigInt(10) ** BigInt(d);     // 纯 BigInt 幂，避免 10**18 的精度问题
    const int = n / base;
    const frac = (n % base).toString().padStart(d, '0').replace(/0+$/, '');
    return frac ? `${int}.${frac}` : `${int}`;
  } catch {
    return raw;
  }
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

function badge(color, text) {
  return <span className="badge" style={{ background: color }}>{text}</span>;
}

function short(s) {
  return s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '-';
}

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

  // 同步 URL，便于分享
  useEffect(() => {
    const sp = new URLSearchParams();
    if (address) sp.set('address', address);
    if (network) sp.set('network', network);
    const newUrl = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [address, network]);

  const ops = useMemo(() => {
    if (!data?.operations) return [];
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

  useEffect(() => {
    if (address) fetchOps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Unit Operations Viewer</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        输入地址，查询该地址相关的 Deposit / Withdraw 操作（数据来源：Hyperunit API）。
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="例如：0xa6f1Ef42D335Ec7CbfC39f57269c851568300132"
          style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', background: '#ffffff' }}
        />
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', background: '#ffffff' }}
        >
          <option value="mainnet">Mainnet</option>
          <option value="testnet">Testnet</option>
        </select>
        <button
          onClick={fetchOps}
          disabled={!address || loading}
          style={{
            border: '1px solid #111827',
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

      {/* 协议地址（可选） */}
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

      {/* 列表（表格）展示 */}
      {ops.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>时间</th>
                <th style={{ minWidth: 80 }}>资产</th>
                <th style={{ minWidth: 150 }}>链路</th>
                <th style={{ minWidth: 150 }}>金额</th>
                <th style={{ minWidth: 120 }}>目的链费用</th>
                <th style={{ minWidth: 160 }}>来源地址</th>
                <th style={{ minWidth: 160 }}>目的地址</th>
                <th style={{ minWidth: 120 }}>状态</th>
                <th style={{ minWidth: 140 }}>源Tx</th>
                <th style={{ minWidth: 140 }}>目的Tx</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op, idx) => {
                const color = STATE_COLOR[op.state] || '#4b5563';
                return (
                  <tr key={idx}>
                    <td>{op.opCreatedAt ? new Date(op.opCreatedAt).toLocaleString() : ''}</td>
                    <td>{badge('#111827', op.asset?.toUpperCase() || 'ASSET')}</td>
                    <td>{`${op.sourceChain} → ${op.destinationChain}`}</td>
                    <td>{humanAmount(op.asset, op.sourceAmount)} {op.asset?.toUpperCase()}</td>
                    <td>{op.destinationFeeAmount ? humanAmount(op.asset, op.destinationFeeAmount) : '-'}</td>
                    <td><code>{short(op.sourceAddress)}</code></td>
                    <td><code>{op.destinationAddress ? short(op.destinationAddress) : '-'}</code></td>
                    <td>{badge(color, op.state)}</td>
                    <td><code>{short(op.sourceTxHash)}</code></td>
                    <td><code>{op.destinationTxHash ? short(op.destinationTxHash) : '-'}</code></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && ops.length === 0 && address && !error && (
        <div style={{ color: '#6b7280', marginTop: 12 }}>没有找到相关操作。</div>
      )}
    </main>
  );
}
