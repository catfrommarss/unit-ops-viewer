'use client';

import { useEffect, useMemo, useState } from 'react';

const ASSET_DECIMALS = { btc: 8, eth: 18, sol: 9 };
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

function humanAmount(asset, raw) {
  if (!raw) return '';
  const a = (asset || '').toLowerCase();
  const d = ASSET_DECIMALS[a] ?? 6;
  try {
    const n = BigInt(raw);
    const base = BigInt(10) ** BigInt(d); // 纯 BigInt 幂
    const int = n / base;
    const frac = (n % base).toString().padStart(d, '0').replace(/0+$/, '');
    return frac ? `${int}.${frac}` : `${int}`;
  } catch {
    return raw;
  }
}

function badge(color, text) {
  return <span className="badge" style={{ background: color }}>{text}</span>;
}

function useQueryParams() {
  const [q, setQ] = useState(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''));
  useEffect(() => { setQ(new URLSearchParams(window.location.search)); }, []);
  return q;
}

/** 单击复制通用组件（全量展示） */
function CopyCell({ text }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }
  return (
    <div className="mono copyable" onClick={onCopy} title="单击复制">
      {text || '-'}
      {copied && <span className="copied-badge">已复制</span>}
    </div>
  );
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
      if (!res.ok) setError(json?.error || `HTTP ${res.status}`);
      else setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // 如果 URL 自带 address，首次自动查询
  useEffect(() => {
    if (address) fetchOps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="container">
      <h1 className="h1">Unit Operations Viewer</h1>
      <p className="sub">输入地址，查询该地址相关的 Deposit / Withdraw 操作（数据来源：Hyperunit API）。</p>

      <div className="controls" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          className="input"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="例如：0xa6f1Ef42D335Ec7CbfC39f57269c851568300132"
          style={{ flex: 1 }}
        />
        <select
          className="select"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
        >
          <option value="mainnet">Mainnet</option>
          <option value="testnet">Testnet</option>
        </select>
        <button onClick={fetchOps} disabled={!address || loading} className="btn">
          {loading ? '查询中…' : '查询'}
        </button>
      </div>

      {error && (
        <div style={{
          background:'#fff',
          border:'1px solid #fecaca',
          color:'#b91c1c',
          padding:12,
          borderRadius:12,
          marginBottom:12,
          boxShadow:'0 3px 12px rgba(185,28,28,.06)'
        }}>
          {error}
        </div>
      )}

      {/* 协议地址（可选） */}
      {data?.addresses?.length > 0 && (
        <div style={{
          background:'var(--card)', border:'1px solid var(--line)', borderRadius:14,
          padding:12, marginBottom:14, boxShadow:'var(--shadow-soft)'
        }}>
          <div style={{ marginBottom: 6, fontWeight: 700 }}>相关协议地址（protocol addresses）</div>
          <ul className="protolist">
            {data.addresses.map((a, i) => (
              <li key={i}>
                [{a.sourceCoinType} → {a.destinationChain}]: <code className="mono">{a.address}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 列表展示（桌面端表格 / 移动端卡片） */}
      {ops.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>时间</th>
                <th style={{ minWidth: 90 }}>资产</th>
                <th style={{ minWidth: 160 }}>链路</th>
                <th style={{ minWidth: 160 }}>金额</th>
                <th style={{ minWidth: 150 }}>目的链费用</th>
                <th style={{ minWidth: 360 }}>来源地址（单击复制）</th>
                <th style={{ minWidth: 360 }}>目的地址（单击复制）</th>
                <th style={{ minWidth: 130 }}>状态</th>
                <th style={{ minWidth: 380 }}>源Tx（单击复制）</th>
                <th style={{ minWidth: 380 }}>目的Tx（单击复制）</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op, idx) => {
                const color = STATE_COLOR[op.state] || '#4b5563';
                return (
                  <tr key={idx}>
                    <td data-label="时间">{op.opCreatedAt ? new Date(op.opCreatedAt).toLocaleString() : ''}</td>
                    <td data-label="资产">{badge('#111827', op.asset?.toUpperCase() || 'ASSET')}</td>
                    <td data-label="链路">{`${op.sourceChain} → ${op.destinationChain}`}</td>
                    <td data-label="金额">{humanAmount(op.asset, op.sourceAmount)} {op.asset?.toUpperCase()}</td>
                    <td data-label="目的链费用">{op.destinationFeeAmount ? humanAmount(op.asset, op.destinationFeeAmount) : '-'}</td>
                    <td data-label="来源地址"><CopyCell text={op.sourceAddress} /></td>
                    <td data-label="目的地址"><CopyCell text={op.destinationAddress} /></td>
                    <td data-label="状态">{badge(color, op.state)}</td>
                    <td data-label="源Tx"><CopyCell text={op.sourceTxHash} /></td>
                    <td data-label="目的Tx"><CopyCell text={op.destinationTxHash} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && ops.length === 0 && address && !error && (
        <div style={{ color: 'var(--muted)', marginTop: 12 }}>没有找到相关操作。</div>
      )}
    </main>
  );
}
