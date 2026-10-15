import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CategoryTick } from './CategoryTick';

export interface VisibilityBarDatum {
  name: string;
  /** 0–100, from a server ratio (`ratioChartValue`). */
  visibility: number;
  /** `{num}/{den}` shown in the tooltip. */
  fraction?: string;
  color?: string;
}

/** v1 tooltip style. */
export const tooltipStyle = {
  contentStyle: { backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' },
  labelStyle: { color: '#F9FAFB' },
  itemStyle: { color: '#E5E7EB' },
};

/** The v1 report bar chart (platform / category visibility), fed with server numbers only. */
export function VisibilityBarChart({
  data,
  color = '#8B5CF6',
  height = 360,
  wrapLabels = false,
  emptyText = 'No data available',
}: {
  data: VisibilityBarDatum[];
  color?: string;
  height?: number;
  wrapLabels?: boolean;
  emptyText?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600 dark:text-gray-400">
        {emptyText}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: wrapLabels ? 70 : 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
        {wrapLabels ? (
          <XAxis dataKey="name" stroke="#6B7280" height={70} interval={0} tick={<CategoryTick />} />
        ) : (
          <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12, fill: '#9CA3AF' }} />
        )}
        <YAxis
          stroke="#9CA3AF"
          tick={{ fontSize: 12, fill: '#9CA3AF' }}
          domain={[0, 100]}
          unit="%"
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, _name, item) => {
            const fraction = (item.payload as VisibilityBarDatum | undefined)?.fraction;
            return [`${String(value)}%${fraction ? ` (${fraction})` : ''}`, 'Visibility'];
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '10px' }} />
        <Bar dataKey="visibility" fill={color} name="Visibility %" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
