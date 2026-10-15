import type { PlansResponse, TopupPack } from '@pv/shared';
import { Button } from '../../components/ui/Button';
import { money, number } from '../../lib/format';

/** v1 "Need more flexibility?" top-up row; packs and prices from `/plans` (F-30). */
export function TopupPacks({
  topups,
  busyPack,
  onBuy,
}: {
  topups: PlansResponse['topups'];
  busyPack: TopupPack | null;
  onBuy: (pack: TopupPack) => void;
}) {
  return (
    <section className="bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700 p-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Need more flexibility?
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Top up your credits anytime. Purchased credits never expire.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
          {topups.map((t) => (
            <div
              key={t.pack}
              className="bg-gray-50 dark:bg-dark-800 rounded-xl p-4 text-center border border-gray-200 dark:border-dark-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
            >
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {number(t.credits)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Credits</p>
              <Button
                size="sm"
                className="w-full"
                loading={busyPack === t.pack}
                disabled={busyPack !== null}
                onClick={() => onBuy(t.pack)}
              >
                Buy for {money(t.priceCents)}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
