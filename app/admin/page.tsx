'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Music2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { composers } from '@/lib/composers';

type AdminRow = {
  submission_id: string;
  champion_id: string;
  runner_up_id: string;
  semifinalistIds: string[];
  display_name: string | null;
  named_consent: number;
  bracket: unknown;
  created_at: string;
  updated_at: string;
};
type AdminData = {
  total: number;
  named: number;
  shown: number;
  rows: AdminRow[];
};
const byId = new Map(composers.map((composer) => [composer.id, composer]));
const endpoint = () =>
  window.location.hostname === 'vulpexy.github.io'
    ? 'https://composer-world-cup-48.minervaw59.chatgpt.site/api/admin/results'
    : '/api/admin/results';
const csvCell = (value: unknown) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [namedOnly, setNamedOnly] = useState(false);
  const request = async (nextQuery = query, nextNamed = namedOnly) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (nextQuery.trim()) params.set('q', nextQuery.trim());
      if (nextNamed) params.set('named', '1');
      const response = await fetch(`${endpoint()}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        setAuthorized(false);
        throw new Error('管理密码不正确。');
      }
      if (!response.ok) throw new Error('数据服务暂时不可用。');
      setData(await response.json());
      setAuthorized(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取失败。');
    } finally {
      setLoading(false);
    }
  };
  const rows = useMemo(() => data?.rows || [], [data]);
  const exportCsv = () => {
    if (!rows.length) return;
    const header = [
      '提交时间',
      '昵称',
      '冠军',
      '亚军',
      '另外两位四强',
      '是否记名',
      '匿名编号',
    ];
    const lines = rows.map((row) =>
      [
        row.created_at,
        row.display_name || '',
        byId.get(row.champion_id)?.nameZh || row.champion_id,
        byId.get(row.runner_up_id)?.nameZh || row.runner_up_id,
        row.semifinalistIds.map((id) => byId.get(id)?.nameZh || id).join(' / '),
        row.named_consent ? '是' : '否',
        row.submission_id,
      ]
        .map(csvCell)
        .join(','),
    );
    const blob = new Blob(
      ['\uFEFF' + [header.map(csvCell).join(','), ...lines].join('\r\n')],
      { type: 'text/csv;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `大师对位-MusiCup-统计-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a href="/">
          <span>
            <Music2 />
          </span>
          <div>
            <strong>大师对位 · MusiCup</strong>
            <small>古典作曲家世界杯 · 数据管理</small>
          </div>
        </a>
        {authorized && (
          <Button
            variant="ghost"
            onClick={() => {
              setAuthorized(false);
              setToken('');
              setData(null);
            }}
          >
            <LogOut />
            退出管理
          </Button>
        )}
      </header>
      {!authorized ? (
        <section className="admin-login">
          <div className="admin-seal">
            <LockKeyhole />
          </div>
          <p className="kicker">ADMINISTRATOR</p>
          <h1>进入数据管理后台</h1>
          <p>输入管理密码后，可以查看匿名结果和玩家自愿提交的具名结果。</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              request();
            }}
          >
            <label>
              管理密码
              <div>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((value) => !value)}
                  aria-label={showToken ? '隐藏密码' : '显示密码'}
                >
                  {showToken ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            <Button
              className="primary-action"
              type="submit"
              disabled={!token || loading}
            >
              {loading ? <LoaderCircle className="spin" /> : <LockKeyhole />}
              验证并进入
            </Button>
          </form>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <small>
            <ShieldCheck />
            管理密码只用于本次验证，不会写入浏览器存储。
          </small>
        </section>
      ) : (
        <section className="admin-dashboard">
          <div className="admin-title">
            <div>
              <p className="kicker">RESULTS DATABASE</p>
              <h1>比赛结果数据</h1>
            </div>
            <Button
              className="primary-action"
              onClick={exportCsv}
              disabled={!rows.length}
            >
              <Download />
              导出当前结果 CSV
            </Button>
          </div>
          <div className="admin-metrics">
            <article>
              <span>全部完整结果</span>
              <strong>{data?.total || 0}</strong>
            </article>
            <article>
              <span>自愿记名结果</span>
              <strong>{data?.named || 0}</strong>
            </article>
            <article>
              <span>当前显示</span>
              <strong>{data?.shown || 0}</strong>
            </article>
          </div>
          <div className="admin-filters">
            <label>
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="按昵称搜索"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') request();
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={namedOnly}
                onChange={(event) => {
                  setNamedOnly(event.target.checked);
                  request(query, event.target.checked);
                }}
              />
              只看自愿记名
            </label>
            <Button
              variant="outline"
              onClick={() => request()}
              disabled={loading}
            >
              {loading ? <LoaderCircle className="spin" /> : <Search />}查询
            </Button>
          </div>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>提交时间</th>
                  <th>昵称</th>
                  <th>冠军</th>
                  <th>亚军</th>
                  <th>另外两位四强</th>
                  <th>记录</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.submission_id}>
                    <td>{new Date(row.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      {row.display_name || (
                        <span className="anonymous">匿名</span>
                      )}
                    </td>
                    <td>
                      <b>
                        {byId.get(row.champion_id)?.nameZh || row.champion_id}
                      </b>
                    </td>
                    <td>
                      {byId.get(row.runner_up_id)?.nameZh || row.runner_up_id}
                    </td>
                    <td>
                      {row.semifinalistIds
                        .map((id) => byId.get(id)?.nameZh || id)
                        .join('、')}
                    </td>
                    <td>
                      {row.bracket ? (
                        <details>
                          <summary>完整签表</summary>
                          <pre>{JSON.stringify(row.bracket, null, 2)}</pre>
                        </details>
                      ) : (
                        '仅名次'
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="admin-empty">
                      暂无符合条件的数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="admin-footnote">
            后台最多显示最近500条符合条件的记录；导出文件与当前筛选结果一致。
          </p>
        </section>
      )}
    </main>
  );
}

