'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

/** ====== 工具 & 显示辅助 ====== */
const ASSET_DECIMALS = { btc: 8, eth: 18, sol: 9 };
function humanAmount(asset, raw) {
  if (!raw) return '';
  const a = (asset || '').toLowerCase();
  const d = ASSET_DECIMALS[a] ?? 6;
  try {
    const n = BigInt(raw);
    const base = BigInt(10) ** BigInt(d);
    const int = n / base;
    const fracRaw = (n % base).toString().padStart(d, '0').replace(/0+$/, '');
    return fracRaw ? `${int}.${fracRaw}` : `${int}`;
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

function Badge({ color, text }) {
  return <span className="badge" style={{ background: color }}>{text}</span>;
}

function useQueryParams() {
  const [q, setQ] = useState(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  );
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp);
  }, []);
  return q;
}

/** ====== 列配置（去掉 协议地址/费用；min=40，像 Excel 一样可缩得很窄） ====== */
const MIN_COL = 40;
const COLUMN_DEFS = [
  { key: 'time', label: '时间', min: MIN_COL, init: 160 },
  { key: 'asset', label: '资产', min: MIN_COL, init: 90 },
  { key: 'route', label: '路径', min: MIN_COL, init: 140 },
  { key: 'state', label: '状态', min: MIN_COL, init: 120 },
  { key: 'amount', label: '金额', min: MIN_COL, init: 160 },
  { key: 'sourceAddress', label: '来源地址', min: MIN_COL, init: 480, mono: true, forceOneLine: true, tooltip: true },
  { key: 'destinationAddress', label: '目的地址', min: MIN_COL, init: 480, mono: true, forceOneLine: true, tooltip: true },
  { key: 'sourceTxHash', label: '源Tx', min: MIN_COL, init: 560, mono: true, forceOneLine: true, tooltip: true },
  { key: 'destinationTxHash', label: '目的Tx', min: MIN_COL, init: 560, mono: true, forceOneLine: true, tooltip: true },
];

export default function Page() {
  const q = useQueryParams();
  const [address, setAddress] = useState(q.get('address') || '');
  const [network, setNetwork] = useState(q.get('network') || 'mainnet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // 列宽状态
  const [colWidths, setColWidths] = useState(() =>
    COLUMN_DEFS.reduce((acc, c) => { acc[c.key] = c.init; return acc; }, {})
  );

  // 拖拽状态
  const dragRef = useRef({ activeKey: null, startX: 0, startW: 0 });

  // 同步 URL
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
    if (!address) return;
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

  /** ====== 拖拽列宽（最小 40px） ====== */
  const onDown = (key, e) => {
    const th = e.currentTarget.parentElement; // <th>
    const startW = th.getBoundingClientRect().width;
    dragRef.current = { activeKey: key, startX: e.clientX, startW };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

  const onMove = useCallback((e) => {
    const { activeKey, startX, startW } = dragRef.current;
    if (!activeKey) return;
    const delta = e.clientX - startX;
    const def = COLUMN_DEFS.find(c => c.key === activeKey);
    const newW = Math.max(def?.min ?? MIN_COL, Math.round(startW + delta));
    setColWidths(prev => ({ ...prev, [activeKey]: newW }));
  }, []);

  const onUp = useCallback(() => {
    dragRef.current = { activeKey: null, startX: 0, startW: 0 };
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }, [onMove]);

  /** ====== 单元格内容渲染（长字段用 title 提示，避免跨列遮挡） ====== */
  const renderCell = (op, key) => {
    switch (key) {
      case 'time':
        return op.opCreatedAt ? new Date(op.opCreatedAt).toLocaleString() : '';
      case 'asset':
        return <Badge color="#111827" text={op.asset?.toUpperCase() || 'ASSET'} />;
      case 'route':
        return `${op.sourceChain} → ${op.destinationChain}`;
      case 'state':
        return <Badge color={STATE_COLOR[op.state] || '#4b5563'} text={op.state || ''} />;
      case 'amount':
        return `${humanAmount(op.asset, op.sourceAmount)} ${op.asset?.toUpperCase()}`;
      case 'sourceAddress':
        return op.sourceAddress || '';
      case 'destinationAddress':
        return op.destinationAddress || '-';
      case 'sourceTxHash':
        return op.sourceTxHash || '';
      case 'destinationTxHash':
        return op.destinationTxHash || '-';
      default:
        return '';
    }
  };

  /** ====== 导出 CSV（当前列顺序 + 表内数据） ====== */
  const downloadCSV = () => {
    const headers = COLUMN_DEFS.map(c => c.label);
    const rows = ops.map(op => COLUMN_DEFS.map(c => {
      const val = renderPlain(op, c.key);
      // 转义 CSV
      const s = String(val ?? '');
      const needQuote = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needQuote ? `"${escaped}"` : escaped;
    }));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `unit-operations-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导出使用的“纯文本渲染”，与表格视觉一致
  function renderPlain(op, key) {
    switch (key) {
      case 'time': return op.opCreatedAt ? new Date(op.opCreatedAt).toLocaleString() : '';
      case 'asset': return (op.asset || '').toUpperCase();
      case 'route': return `${op.sourceChain} → ${op.destinationChain}`;
      case 'state': return op.state || '';
      case 'amount': return `${humanAmount(op.asset, op.sourceAmount)} ${(op.asset || '').toUpperCase()}`;
      case 'sourceAddress': return op.sourceAddress || '';
      case 'destinationAddress': return op.destinationAddress || '-';
      case 'sourceTxHash': return op.sourceTxHash || '';
      case 'destinationTxHash': return op.destinationTxHash || '-';
      default: return '';
    }
  }

  return (
    <main className="page-root">
      <header className="page-header">
        <h1>Unit Operations Viewer</h1>
        <p className="sub">输入地址，查询该地址相关的 Deposit / Withdraw 操作。</p>
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
          <button onClick={fetchOps} disabled={!address || loading} className="btn">
            {loading ? '查询中…' : '查询'}
          </button>
          <button onClick={downloadCSV} disabled={ops.length === 0} className="btn btn-secondary" title="导出当前表格为 CSV">
            下载 CSV
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {data?.addresses?.length > 0 && (
          <div className="proto-box">
            <div className="proto-title"><strong>相关协议地址</strong></div>
            <ul className="proto-list">
              {data.addresses.map((a, i) => (
                <li key={i}>
                  [{a.sourceCoinType} → {a.destinationChain}]: <code className="mono">{a.address}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <section className="table-wrap">
        <div className="table-scroll" title="提示：按住表头右侧竖条可拖动列宽；悬停可看被省略的完整值；可下载 CSV">
          <table className="u-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              {COLUMN_DEFS.map(col => (
                <col key={col.key} style={{ width: (colWidths[col.key] ?? col.init) + 'px' }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMN_DEFS.map(col => (
                  <th key={col.key} className="th">
                    <div className="th-inner">
                      <span className="th-label">{col.label}</span>
                      <span
                        className="th-resizer"
                        onMouseDown={(e) => onDown(col.key, e)}
                        title="拖拽调整列宽"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && ops.length === 0 && address && !error && (
                <tr><td className="empty" colSpan={COLUMN_DEFS.length}>没有找到相关操作。</td></tr>
              )}
              {ops.map((op, idx) => (
                <tr key={idx} className="tr">
                  {COLUMN_DEFS.map(col => {
                    const raw = renderCell(op, col.key);
                    const classNames = [
                      'td',
                      col.mono ? 'mono' : '',
                      col.forceOneLine ? 'nowrap' : '',
                    ].join(' ');
                    return (
                      <td key={col.key} className={classNames}>
                        {/* cell-inner 负责裁切，避免跨列遮挡；title 提供完整查看 */}
                        <div className="cell" title={col.tooltip ? String(renderPlain(op, col.key)) : undefined}>
                          {raw}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
