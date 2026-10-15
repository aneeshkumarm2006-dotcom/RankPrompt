import { Award, Eye, Link2, ListChecks, Medal, PieChart, Sparkles } from 'lucide-react';
import { MetricTile } from '../../components/ui/MetricTile';
import { pluralize, rank } from '../../lib/format';
import type { ReportAggregates } from './viewModel';

/** The D-012 metric tiles. Server numbers only; each ratio shows `{num}/{den}` (05). */
export function ReportTiles({ aggregates }: { aggregates: ReportAggregates | null }) {
  const total = aggregates?.total ?? null;
  const aio = aggregates?.byPlatform.google_aio?.aioPresence;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      <MetricTile label="Visibility" icon={Eye} accent="purple" ratio={total?.visibility ?? null} />
      <MetricTile
        label="Citation rate"
        icon={Link2}
        accent="blue"
        ratio={total?.citationRate ?? null}
      />
      <MetricTile
        label="Prompt coverage"
        icon={ListChecks}
        accent="green"
        ratio={total?.promptCoverage ?? null}
      />
      <MetricTile label="Top-3 rate" icon={Medal} accent="orange" ratio={total?.top3Rate ?? null} />
      <MetricTile
        label="Average rank"
        icon={Award}
        accent="red"
        value={rank(total?.avgRank.value)}
        hint={`${pluralize(total?.avgRank.count ?? 0, 'answer')} ranked`}
      />
      <MetricTile
        label="Share of voice"
        icon={PieChart}
        accent="purple"
        ratio={total?.shareOfVoice ?? null}
      />
      {aio && (
        <MetricTile
          label="AI Overviews presence"
          icon={Sparkles}
          accent="blue"
          ratio={aio}
          hint="Google showed an AI Overview"
        />
      )}
    </div>
  );
}
