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
    const base = BigInt(10) ** BigInt(d);
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

function getExplorerUrl(chain, txHash) {
  if (!txHash) return null;
  const lower = (chain || '').toLowerCase();
  if (lower.includes('eth')) return `https://etherscan.io/tx/${txHash}`;
  if (lower.includes('sol')) return `https://solscan.io/tx/${txHash}`;
  if (lower.includes('btc')) return `https://www.blockchain.com/btc/tx/${txHash}`;
  return null;
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
  }, []);

  function downloadCSV() {
    if (!ops.length) return;

    const headers = [
      '时间',
      '资产',
      '链路',
      '金额',
      '目的链费用',
      '来源地址',
      '目的地址',
      '状态',
      '源Tx',
      '目的Tx'
    ];

    const rows = ops.map(op => [
      new Date(op.opCreatedAt).toLocaleString(),
      op.asset?.toUpperCase() || '',
      `${op.sourceChain} → ${op.destinationChain}`,
      humanAmount(op.asset, op.sourceAmount),
      op.destinationFeeAmount ? humanAmount(op.asset, op.destinationFeeAmount) : '',
      op.sourceAddress || '',
      op.destinationAddress || '',
      op.state,
      op.sourceTxHash || '',
      op.destinationTxHash || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'unit_operations.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Unit Operations Viewer</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        输入地址，查询该地址相关的 Deposit / Withdraw 操作（数据来源：Hyperunit API）。
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="例如：0xa6f1Ef42D335Ec7CbfC39f57269c851568300132"
          style={{ flex: 1, minWidth: 240, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', background: '#ffffff' }}
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
        <button
          onClick={downloadCSV}
          disabled={ops.length === 0}
          style={{
            border: '1px solid #374151',
            borderRadius: 8,
            padding: '10px 16px',
            background: '#f3f4f6',
            color: '#111827',
            cursor: ops.length === 0 ? 'not-allowed' : 'pointer',
            opacity: ops.length === 0 ? 0.5 : 1
          }}
        >
          下载 CSV
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

      {ops.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>资产</th>
                <th>链路</th>
                <th>金额</th>
                <th>目的链费用</th>
                <th>来源地址</th>
                <th>目的地址</th>
                <th>状态</th>
                <th>源Tx</th>
                <th>目的Tx</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op, idx) => {
                const color = STATE_COLOR[op.state] || '#4b5563';
                const sourceTxUrl = getExplorerUrl(op.sourceChain, op.sourceTxHash);
                const destinationTxUrl = getExplorerUrl(op.destinationChain, op.destinationTxHash);
                return (
                  <tr key={idx}>
                    <td className="time-cell">{op.opCreatedAt ? new Date(op.opCreatedAt).toLocaleString() : ''}</td>
                    <td>{badge('#111827', op.asset?.toUpperCase() || 'ASSET')}</td>
                    <td className="chain-cell">{`${op.sourceChain} → ${op.destinationChain}`}</td>
                    <td className="amount-cell">{humanAmount(op.asset, op.sourceAmount)} {op.asset?.toUpperCase()}</td>
                    <td>{op.destinationFeeAmount ? humanAmount(op.asset, op.destinationFeeAmount) : '-'}</td>
                    <td className="address-cell"><code>{op.sourceAddress || '-'}</code></td>
                    <td className="address-cell"><code>{op.destinationAddress || '-'}</code></td>
                    <td>{badge(color, op.state)}</td>
                    <td className="tx-hash-cell">
                      {sourceTxUrl ? (
                        <a href={sourceTxUrl} target="_blank" rel="noopener noreferrer">{op.sourceTxHash}</a>
                      ) : '-'}
                    </td>
                    <td className="tx-hash-cell">
                      {destinationTxUrl ? (
                        <a href={destinationTxUrl} target="_blank" rel="noopener noreferrer">{op.destinationTxHash}</a>
                      ) : '-'}
                    </td>
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
