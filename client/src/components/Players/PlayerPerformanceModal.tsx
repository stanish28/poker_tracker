import React, { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { apiService } from '../../services/api';
import { Player, PlayerPerformanceSummary } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';

interface PlayerPerformanceModalProps {
  player: Player | null;
  onClose: () => void;
}

const PlayerPerformanceModal: React.FC<PlayerPerformanceModalProps> = ({ player, onClose }) => {
  const [dataPoints, setDataPoints] = useState<Array<{ date: string; cumulativeProfit: number; profit: number }>>([]);
  const [playerName, setPlayerName] = useState('');
  const [summary, setSummary] = useState<PlayerPerformanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    let cancelled = false;
    const fetchPerformance = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await apiService.getPlayerPerformance(player.id);
        if (cancelled) return;
        setPlayerName(result.player.name);
        setSummary(result.summary ?? null);
        setDataPoints(
          result.dataPoints.map((d) => ({
            date: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
            cumulativeProfit: d.cumulativeProfit,
            profit: d.profit
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load performance data');
          console.error(err);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchPerformance();
    return () => {
      cancelled = true;
    };
  }, [player]);

  const currentProfit = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].cumulativeProfit : 0;

  const xTickInterval = dataPoints.length > 12 ? ('preserveStartEnd' as const) : 0;

  const lineYDomain = useMemo((): [number, number] => {
    if (dataPoints.length === 0) return [0, 1];
    const vals = dataPoints.map((d) => d.cumulativeProfit);
    let lo = Math.min(0, ...vals);
    let hi = Math.max(0, ...vals);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = Math.max((hi - lo) * 0.08, 5);
    return [lo - pad, hi + pad];
  }, [dataPoints]);

  const barYDomain = useMemo((): [number, number] => {
    if (dataPoints.length === 0) return [-1, 1];
    const vals = dataPoints.map((d) => d.profit);
    let lo = Math.min(0, ...vals);
    let hi = Math.max(0, ...vals);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = Math.max((hi - lo) * 0.12, 8);
    return [lo - pad, hi + pad];
  }, [dataPoints]);

  const barBottomMargin = dataPoints.length > 5 ? 56 : 24;

  if (!player) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        className="flex h-[92dvh] max-h-[92dvh] w-full min-h-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:h-[88vh] sm:max-h-[88vh] sm:max-w-2xl sm:rounded-lg slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="performance-modal-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:p-6">
          <div className="min-w-0 pr-2">
            <h2 id="performance-modal-title" className="text-lg font-semibold text-gray-900 sm:text-xl">
              Playing curve {playerName ? `– ${playerName}` : ''}
            </h2>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Cumulative profit over time.
              {dataPoints.length > 0 && (
                <>
                  {' '}
                  Now:{' '}
                  <span className={currentProfit >= 0 ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                    ${currentProfit.toFixed(2)}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 sm:p-6 sm:pt-4">
          {isLoading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="md" text="Loading curve..." />
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {!isLoading && !error && dataPoints.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No games recorded yet. Play some games to see your curve.
            </div>
          )}
          {!isLoading && !error && dataPoints.length > 0 && (
            <div className="space-y-5 sm:space-y-6">
              {/* How you've played + Trajectory */}
              {summary && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">How you&apos;ve played</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500">Win rate</p>
                      <p className="text-lg font-semibold text-gray-900">{summary.winRatePercent}%</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500">Avg profit/game</p>
                      <p className={`text-lg font-semibold ${summary.avgProfitPerGame >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${summary.avgProfitPerGame.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500">Best game</p>
                      <p className="text-lg font-semibold text-green-600">${summary.bestGame.profit.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500">Worst game</p>
                      <p className="text-lg font-semibold text-red-600">${summary.worstGame.profit.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500">Current streak</p>
                      <p className="text-lg font-semibold text-gray-900 flex items-center gap-1">
                        {summary.currentStreak.type === 'winning' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        {summary.currentStreak.count} {summary.currentStreak.type}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 sm:col-span-1 col-span-2">
                      <p className="text-xs text-gray-500">Trajectory</p>
                      <p className="mt-0.5 flex items-start gap-1.5 text-sm font-medium leading-snug text-gray-900">
                        {summary.trend === 'up' && <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />}
                        {summary.trend === 'down' && <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                        {summary.trend === 'stable' && <Minus className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />}
                        <span className="min-w-0 break-words">{summary.trendLabel}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cumulative profit over time */}
              <div className="min-w-0">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Cumulative profit over time</h3>
                <div className="h-[220px] w-full min-w-0 overflow-hidden rounded-md sm:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dataPoints}
                      margin={{ top: 8, right: 8, left: 4, bottom: dataPoints.length > 8 ? 40 : 14 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval={xTickInterval}
                        angle={dataPoints.length > 6 ? -35 : 0}
                        textAnchor={dataPoints.length > 6 ? 'end' : 'middle'}
                        height={dataPoints.length > 6 ? 52 : 32}
                      />
                      <YAxis
                        width={48}
                        tick={{ fontSize: 10 }}
                        domain={lineYDomain}
                        tickFormatter={(v: number) => `$${v}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative profit']}
                        labelFormatter={(label: string) => `Game: ${label}`}
                      />
                      <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                      <Line
                        type="monotone"
                        dataKey="cumulativeProfit"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                        name="Cumulative profit"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Profit per game (bar chart) — extra bottom margin for angled labels; scrolls inside modal */}
              <div className="min-w-0 pb-1">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Profit per game</h3>
                <div className="h-[220px] w-full min-w-0 overflow-hidden rounded-md sm:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dataPoints}
                      margin={{
                        top: 10,
                        right: 8,
                        left: 4,
                        bottom: barBottomMargin
                      }}
                      barCategoryGap="12%"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9 }}
                        interval={xTickInterval}
                        angle={dataPoints.length > 5 ? -38 : 0}
                        textAnchor={dataPoints.length > 5 ? 'end' : 'middle'}
                        height={dataPoints.length > 5 ? 52 : 30}
                      />
                      <YAxis
                        width={48}
                        tick={{ fontSize: 10 }}
                        domain={barYDomain}
                        tickFormatter={(v: number) => `$${v}`}
                      />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Profit']}
                        labelFormatter={(label: string) => `Game: ${label}`}
                      />
                      <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                      <Bar dataKey="profit" name="Profit" maxBarSize={40} radius={[2, 2, 0, 0]} isAnimationActive={false}>
                        {dataPoints.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#16a34a' : '#dc2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-md w-full sm:w-auto">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerPerformanceModal;
