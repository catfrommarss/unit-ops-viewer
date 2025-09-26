'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/** ========================= 工具函数 ========================= */
const ASSET_DECIMALS = { btc: 8, eth: 18, sol: 9 };

function humanAmount(asset, raw) {
  if (!raw && raw !== 0) return '';
  const a = (asset || '').toLowerCase();
  const d = ASSET_DECIMALS[a] ?? 6;
  try {
    const n = BigInt(raw);
    const base = BigInt(10) ** BigInt(d);
    const int = n / base;
    const frac = (n % base).toString().padStart(d, '0').replace(/0+$/, '');
    return frac ? `${int}.${frac}` : `${int}`;
  } catch {
    return String(raw);
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

function Badge({ color = '#111827', children }) {
  return (
    <span
      className="badge"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

function useQueryParams() {
  const [q, setQ] = useState(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''));
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp);
  }, []);
  return q;
}

/** ================ 可拖动列宽 Hook ================= */
function useResizableColumns(initial) {
  const [widths, setWidths] = useState(initial);
  const dragging = useRef(null); // { key, startX, startWidth }

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return;
      const { key, startX, startWidth } = dragging.current;
      const delta = e.clientX - startX;
      const next = Math.max(80, startWidth + delta); // 每列最小80px，避免挤没
      setWidths((w) => ({ ...w, [key]: next }));
    }
    function onUp() {
      dragging.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startDrag(e, key) {
    const startWidth = widths[key] ?? 160;
    dragging.current = { key, startX: e.clientX, startWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return { widths, startDrag, setWidths };
}

/** ========================= 页面组件 ========================= */
export default function Page() {
  const q = useQueryParams();
  const [address, setAddress] = useState(q.get('address') || '');
  const [network, setNetwork] = useState(q.get('network') || 'mainnet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // 列定义（顺序即表头顺序）
  const columns = [
    { key: 'time', title: '时间' },
    { key: 'asset', title: '资产' },
    { key: 'chains', title: '链路' },
    { key: 'state', title: '状态' },
    { key: 'amount', title: '金额' },
    { key: 'sourceAddress', title: '来源地址', forceOneLine: true },
    { key: 'destinationAddress', title: '目的地址', forceOneLine: true },
    { key: 'protocolAddress', title: '协议地址', forceOneLine: true },
    { key: 'sourceTxHash', title: '源Tx', forceOneLine: true },
    { key: 'destinationTxHash', title: '目的Tx', forceOneLine: true }
  ];

  // 初始列宽（可根据需要调整）
  const { widths, startDrag } = useResizableColumns({
    time: 160,
    asset: 100,
    chains: 140,
    state: 120,
    amount: 160,
    sourceAddress: 420,
    destinationAddress: 420,
    protocolAddress: 420,
    sourceTxHash: 520,
    destinationTxHash: 520
  });

  // 同步 URL（便于分享）
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
      const res = await fetch(
        `/api/operations?address=${encodeURIComponent(address)}&network=${encodeURIComponent(network)}`
      );
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

  // 如果 URL 自带 address，第一次自动加载
  useEffect(() => {
    if (address) fetchOps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="container">
      <h1 className="title">Unit Operations Viewer</h1>
      <p className="sub">
        输入 Hyperliquid / EVM 地址，查询该地址相关的 Deposit / Withdraw 操作（数据来源：Hyperunit API）。
      </p>

      <div className="toolbar">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="例如：0xa6f1Ef42D335Ec7CbfC39f57269c851568300132"
          className="input"
        />
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          className="select"
        >
          <option value="mainnet">Mainnet</option>
          <option value="testnet">Testnet</option>
        </select>
        <button
          onClick={fetchOps}
          disabled={!address || loading}
          className="btn"
        >
          {loading ? '查询中…' : '查询'}
        </button>
      </div>

      {error && (
        <div className="alert error">{error}</div>
      )}

      {data?.addresses?.length > 0 && (
        <div className="proto-box">
          <div className="proto-title"><strong>相关协议地址（protocol addresses）</strong></div>
          <ul className="proto-list">
            {data.addresses.map((a, i) => (
              <li key={i}>
                [{a.sourceCoinType} → {a.destinationChain}]: <code className="mono">{a.address}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 表格区域 */}
      <div className="table-wrap">
        <div className="table" role="table">
          {/* 表头 */}
          <div className="thead" role="rowgroup">
            <div className="tr" role="row">
              {columns.map((col) => (
                <div
                  key={col.key}
                  role="columnheader"
                  className="th"
                  style={{ width: widths[col.key] }}
                >
                  <span className="th-text">{col.title}</span>
                  <span
                    className="col-resizer"
                    onMouseDown={(e) => startDrag(e, col.key)}
                    title="拖动调整列宽"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 表体 */}
          <div className="tbody" role="rowgroup">
            {ops.map((op, idx) => {
              const color = STATE_COLOR[op.state] || '#4b5563';
              const time = op.opCreatedAt ? new Date(op.opCreatedAt).toLocaleString() : '';
              const chains = `${op.sourceChain} → ${op.destinationChain}`;
              const amount = `${humanAmount(op.asset, op.sourceAmount)} ${op.asset?.toUpperCase() || ''}`;
              return (
                <div className="tr row-hover" role="row" key={idx}>
                  <div className="td" style={{ width: widths.time }}>
                    <span className="mono nowrap">{time}</span>
                  </div>
                  <div className="td" style={{ width: widths.asset }}>
                    <Badge>{op.asset?.toUpperCase() || 'ASSET'}</Badge>
                  </div>
                  <div className="td" style={{ width: widths.chains }}>
                    <span className="mono nowrap">{chains}</span>
                  </div>
                  <div className="td" style={{ width: widths.state }}>
                    <Badge color={color}>{op.state}</Badge>
                  </div>
                  <div className="td" style={{ width: widths.amount }}>
                    <span className="mono nowrap">{amount}</span>
                  </div>
                  <div className="td" style={{ width: widths.sourceAddress }}>
                    <span className="mono nowrap">{op.sourceAddress}</span>
                  </div>
                  <div className="td" style={{ width: widths.destinationAddress }}>
                    <span className="mono nowrap">{op.destinationAddress || '-'}</span>
                  </div>
                  <div className="td" style={{ width: widths.protocolAddress }}>
                    <span className="mono nowrap">{op.protocolAddress}</span>
                  </div>
                  <div className="td" style={{ width: widths.sourceTxHash }}>
                    <span className="mono nowrap">{op.sourceTxHash}</span>
                  </div>
                  <div className="td" style={{ width: widths.destinationTxHash }}>
                    <span className="mono nowrap">{op.destinationTxHash || '-'}</span>
                  </div>
                </div>
              );
            })}

            {!loading && ops.length === 0 && address && !error && (
              <div className="tr empty" role="row">
                <div className="td" style={{ width: '100%' }}>
                  没有找到相关操作。
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
