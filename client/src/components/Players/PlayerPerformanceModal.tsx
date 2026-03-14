import React, { useState, useEffect } from 'react';
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

  if (!player) return null;

  const currentProfit = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].cumulativeProfit : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col slide-up">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Playing curve {playerName ? `– ${playerName}` : ''}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Cumulative profit over time. Where you are now: {dataPoints.length > 0 && (
                <span className={currentProfit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  ${currentProfit.toFixed(2)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 pt-0 flex-1 min-h-0">
          {isLoading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="md" text="Loading curve..." />
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {!isLoading && !error && dataPoints.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No games recorded yet. Play some games to see your curve.
            </div>
          )}
          {!isLoading && !error && dataPoints.length > 0 && (
            <div className="space-y-6 overflow-y-auto">
              {/* How you've played + Trajectory */}
              {summary && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">How you&apos;ve played</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      <p className="text-sm font-medium text-gray-900 flex items-center gap-1 mt-0.5">
                        {summary.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />}
                        {summary.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />}
                        {summary.trend === 'stable' && <Minus className="h-4 w-4 text-gray-500 shrink-0" />}
                        <span className="truncate" title={summary.trendLabel}>{summary.trendLabel}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cumulative profit over time */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Cumulative profit over time</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataPoints} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 11 }} />
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
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Cumulative profit"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Profit per game (bar chart) */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Profit per game</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dataPoints} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v: number) => `$${v}`} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Profit']}
                        labelFormatter={(label: string) => `Game: ${label}`}
                      />
                      <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                      <Bar dataKey="profit" name="Profit" radius={[2, 2, 0, 0]}>
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

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-md">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerPerformanceModal;
