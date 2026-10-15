import { useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBRL, formatBRLCompact } from '../lib/money';

/** Cores categóricas em ordem fixa (validadas para daltonismo). Nunca cicladas: >8 séries viram "Outros". */
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

export interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

function TT({ active, payload, label, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{labelFmt && label ? labelFmt(label) : label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="row" style={{ gap: 6 }}>
          <i style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block' }} />
          <span className="grow">{p.name}</span>
          <strong className="num">{formatBRL(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null;
  return (
    <div className="legend" aria-hidden>
      {series.map((s) => (
        <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>
      ))}
    </div>
  );
}

const axisProps = { tickLine: false, axisLine: false, fontSize: 11 } as const;

export function BarsChart({
  data,
  xKey,
  series,
  xFmt,
  stacked,
  tall,
}: {
  data: object[];
  xKey: string;
  series: SeriesDef[];
  xFmt?: (v: string) => string;
  stacked?: boolean;
  tall?: boolean;
}) {
  return (
    <div className={`chart ${tall ? 'tall' : ''}`}>
      <ResponsiveContainer>
        <BarChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={xKey} tickFormatter={xFmt} {...axisProps} />
          <YAxis tickFormatter={(v) => formatBRLCompact(v)} width={70} {...axisProps} />
          <Tooltip content={<TT labelFmt={xFmt} />} cursor={{ fill: 'var(--grid)' }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              stackId={stacked ? 'a' : undefined}
              radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
              stroke="var(--surface-solid)"
              strokeWidth={stacked ? 1 : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBarsChart({ data, color = 'var(--series-expense)' }: { data: { name: string; total: number }[]; color?: string }) {
  const h = Math.max(140, data.length * 36 + 20);
  return (
    <div style={{ width: '100%', height: h }}>
      <ResponsiveContainer>
        <BarChart data={data as Record<string, unknown>[]} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" tickFormatter={(v) => formatBRLCompact(v)} {...axisProps} />
          <YAxis type="category" dataKey="name" width={140} interval={0} {...axisProps} />
          <Tooltip content={<TT />} cursor={{ fill: 'var(--grid)' }} />
          <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinesChart({
  data,
  xKey,
  series,
  xFmt,
}: {
  data: object[];
  xKey: string;
  series: SeriesDef[];
  xFmt?: (v: string) => string;
}) {
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data as Record<string, unknown>[]} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey={xKey} tickFormatter={xFmt} {...axisProps} />
          <YAxis tickFormatter={(v) => formatBRLCompact(v)} width={70} {...axisProps} />
          <Tooltip content={<TT labelFmt={xFmt} />} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              connectNulls={false}
              dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-solid)', fill: s.color }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cartão de gráfico com alternância para visualização em tabela (acessibilidade). */
export function ChartCard({
  title,
  subtitle,
  children,
  table,
  legend,
  empty,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  table: { head: string[]; rows: (string | number)[][] };
  legend?: SeriesDef[];
  empty?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <div className="small muted">{subtitle}</div>}
        </div>
        {!empty && (
          <button className="btn sm ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        )}
      </div>
      {empty ? (
        <p className="muted small" style={{ padding: '24px 0', textAlign: 'center' }}>Ainda não há dados para este período.</p>
      ) : asTable ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>{table.head.map((h, i) => <th key={h} className={i ? 'r' : ''}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'r' : ''}>{typeof c === 'number' ? formatBRL(c) : c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stack">
          {legend && <Legend series={legend} />}
          {children}
        </div>
      )}
    </section>
  );
}
