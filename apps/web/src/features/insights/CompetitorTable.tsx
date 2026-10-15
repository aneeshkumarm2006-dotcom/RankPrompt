import type { CompetitorInsights } from '@pv/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tooltipStyle } from '../../components/charts/VisibilityBarChart';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/PageHeader';
import { pluralize, rank, ratioChartValue, ratioFraction } from '../../lib/format';
import { RatioCell } from './PlatformScores';

const BRAND_COLOR = '#8B5CF6';
const COMPETITOR_COLOR = '#94A3B8';

type Ratio = { num: number; den: number; rate: number | null };
interface Row {
  key: string;
  name: string;
  isBrand: boolean;
  visibility: Ratio;
  avgRank: { value: number | null; count: number };
  shareOfVoice: Ratio;
  citationRate: Ratio;
}

export function competitorRows(data: CompetitorInsights): Row[] {
  const rows: Row[] = data.brand ? [{ key: 'brand', isBrand: true, ...data.brand }] : [];
  for (const c of data.competitors) rows.push({ key: c.competitorId, isBrand: false, ...c });
  return rows;
}

const HEADERS = ['Company', 'Visibility', 'Avg rank', 'Share of voice', 'Citation rate'];

/** The brand next to every tracked competitor (F-21), server numbers with num/den. */
export function CompetitorTable({ data }: { data: CompetitorInsights }) {
  const rows = competitorRows(data);
  return (
    <Card title="Brand vs Competitors" className="mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-dark-900">
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
            {rows.map((r) => (
              <tr key={r.key} className={r.isBrand ? 'bg-action-50/60 dark:bg-action-900/20' : ''}>
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                  <span className="inline-flex items-center gap-2">
                    {r.name}
                    {r.isBrand && <Badge tone="purple">You</Badge>}
                  </span>
                </td>
                <RatioCell ratio={r.visibility} />
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  <span className="font-medium">{rank(r.avgRank.value)}</span>{' '}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {pluralize(r.avgRank.count, 'ranking')}
                  </span>
                </td>
                <RatioCell ratio={r.shareOfVoice} />
                <RatioCell ratio={r.citationRate} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Share of voice per company, the brand highlighted. */
export function ShareOfVoiceChart({ data }: { data: CompetitorInsights }) {
  const chart = competitorRows(data).map((r) => ({
    name: r.name,
    share: ratioChartValue(r.shareOfVoice),
    fraction: ratioFraction(r.shareOfVoice),
    isBrand: r.isBrand,
  }));
  return (
    <Card title="Share of Voice" className="mb-6">
      {chart.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No data.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, chart.length * 40)}>
          <BarChart
            data={chart}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
            <XAxis
              type="number"
              domain={[0, 100]}
              unit="%"
              stroke="#9CA3AF"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              stroke="#9CA3AF"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, _n, item) => {
                const fraction = (item.payload as { fraction?: string } | undefined)?.fraction;
                return [`${String(value)}%${fraction ? ` (${fraction})` : ''}`, 'Share of voice'];
              }}
            />
            <Bar dataKey="share" radius={[0, 4, 4, 0]}>
              {chart.map((d, i) => (
                <Cell key={i} fill={d.isBrand ? BRAND_COLOR : COMPETITOR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
