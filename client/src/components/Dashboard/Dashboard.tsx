import React, { useState, useEffect } from 'react';
import {
  Users,
  Gamepad2,
  CreditCard,
  DollarSign,
  Activity,
  Trophy,
  TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { apiService } from '../../services/api';
import { DashboardStats } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerNetProfits, setPlayerNetProfits] = useState<Record<string, {
    game_net_profit: number;
    settlement_impact: number;
    true_net_profit: number;
    settlements_count: number;
  }>>({});
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [totalDiscrepancy, setTotalDiscrepancy] = useState<{
    total_positive_profit: number;
    total_negative_profit: number;
    total_discrepancy: number;
    is_balanced: boolean;
    players_count: number;
  } | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

                const [playersData, games, settlements, gameStats, settlementStats, discrepancyData] = await Promise.all([
                  apiService.getPlayers(),
                  apiService.getGames(),
                  apiService.getSettlements(),
                  apiService.getGameStats(),
                  apiService.getSettlementStats(),
                  apiService.getTotalDiscrepancy()
                ]);
        setPlayers(playersData);

        // Fetch true net profit for all players in a single request
        try {
          const netProfitResults = await apiService.getAllPlayersNetProfit();
          const netProfitData: Record<string, any> = {};
          
          // Convert array to object keyed by player_id
          netProfitResults.forEach(result => {
            netProfitData[result.player_id] = result;
          });
          
          setPlayerNetProfits(netProfitData);
        } catch (err) {
          console.error('Failed to fetch bulk net profit data:', err);
          // Fallback: create default data for all players
          const netProfitData: Record<string, any> = {};
          playersData.forEach((player: { id: string; net_profit?: number }) => {
            netProfitData[player.id] = {
              game_net_profit: parseFloat(String(player.net_profit || 0)),
              settlement_impact: 0,
              true_net_profit: parseFloat(String(player.net_profit || 0)),
              settlements_count: 0
            };
          });
          setPlayerNetProfits(netProfitData);
        }

                const totalVolume = parseFloat(String(gameStats.total_buyins || 0)) + parseFloat(String(settlementStats.total_amount || 0));
                
                // Set discrepancy data
                setTotalDiscrepancy(discrepancyData);
        
        // Create recent activity from games and settlements
        const recentActivity = [
          ...games.slice(0, 3).map(game => ({
            id: game.id,
            type: 'game' as const,
            title: `Game on ${new Date(game.date).toLocaleDateString()}`,
            description: `${game.player_count || 0} players, $${parseFloat(String(game.total_buyins || 0)).toFixed(2)} buy-ins`,
            date: game.date,
            amount: parseFloat(String(game.total_buyins || 0))
          })),
          ...settlements.slice(0, 2).map(settlement => ({
            id: settlement.id,
            type: 'settlement' as const,
            title: `${settlement.from_player_name} → ${settlement.to_player_name}`,
            description: settlement.notes || 'Settlement',
            date: settlement.date,
            amount: parseFloat(String(settlement.amount || 0))
          }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

        setStats({
          totalPlayers: playersData.length,
          totalGames: gameStats.total_games,
          totalSettlements: settlementStats.total_settlements,
          totalVolume,
          recentActivity
        });
      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-danger-600 mb-4">
          <Activity className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading dashboard</h3>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      title: 'Total Players',
      value: stats.totalPlayers,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Total Games',
      value: stats.totalGames,
      icon: Gamepad2,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Settlements',
      value: stats.totalSettlements,
      icon: CreditCard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Total Volume',
      value: `$${stats.totalVolume.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Overview of your poker tracking data</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card">
              <div className="flex flex-col sm:flex-row items-center sm:items-start">
                <div className={`p-2 sm:p-3 rounded-lg ${stat.bgColor} mb-2 sm:mb-0`}>
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                </div>
                <div className="sm:ml-4 text-center sm:text-left">
                  <p className="stat-label text-xs sm:text-sm">{stat.title}</p>
                  <p className="stat-value text-xl sm:text-3xl">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total Discrepancy */}
      {totalDiscrepancy && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">System Balance</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  +${totalDiscrepancy.total_positive_profit.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Profits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  -${totalDiscrepancy.total_negative_profit.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Losses</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${totalDiscrepancy.is_balanced ? 'text-green-600' : 'text-orange-600'}`}>
                  ${Math.abs(totalDiscrepancy.total_discrepancy).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  {totalDiscrepancy.is_balanced ? 'Balanced ✅' : 'Discrepancy ⚠️'}
                </div>
              </div>
            </div>
            {!totalDiscrepancy.is_balanced && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center">
                  <div className="text-orange-600 mr-2">⚠️</div>
                  <div className="text-sm text-orange-800">
                    <strong>System discrepancy detected:</strong> ${totalDiscrepancy.total_discrepancy.toFixed(2)}
                    {totalDiscrepancy.total_discrepancy > 0 ? ' more profits than losses' : ' more losses than profits'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaders: Top winners and top losers */}
      {players.length > 0 && Object.keys(playerNetProfits).length > 0 && (() => {
        const withProfit = players.map((p) => ({
          name: p.name,
          true_net_profit: playerNetProfits[p.id]?.true_net_profit ?? 0
        }));
        const topWinners = [...withProfit].filter((p) => p.true_net_profit > 0).sort((a, b) => b.true_net_profit - a.true_net_profit).slice(0, 5);
        const topLosers = [...withProfit].filter((p) => p.true_net_profit < 0).sort((a, b) => a.true_net_profit - b.true_net_profit).slice(0, 5).map((p) => ({ ...p, displayAmount: Math.abs(p.true_net_profit) }));
        const hasLeaders = topWinners.length > 0 || topLosers.length > 0;
        if (!hasLeaders) return null;
        return (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Leaders</h3>
              <p className="text-sm text-gray-500 mt-0.5">Top winners and biggest losses (true net profit)</p>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-5 w-5 text-green-600" />
                    <h4 className="font-medium text-gray-900">Top Winners</h4>
                  </div>
                  {topWinners.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topWinners} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Net profit']} labelFormatter={(name) => name} />
                          <Bar dataKey="true_net_profit" radius={[0, 4, 4, 0]}>
                            {topWinners.map((_, i) => (
                              <Cell key={i} fill="#16a34a" />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No winners yet</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    <h4 className="font-medium text-gray-900">Biggest Losses</h4>
                  </div>
                  {topLosers.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topLosers} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(v: number) => [`-$${v.toFixed(2)}`, 'Net loss']} labelFormatter={(name) => name} />
                          <Bar dataKey="displayAmount" radius={[0, 4, 4, 0]}>
                            {topLosers.map((_, i) => (
                              <Cell key={i} fill="#dc2626" />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-4">No losses yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="card-content">
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.map((activity) => {
                  const Icon = activity.type === 'game' ? Gamepad2 : CreditCard;
                  return (
                    <div key={activity.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="h-4 w-4 text-gray-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {activity.title}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {activity.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.amount ? `$${activity.amount.toFixed(2)}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Games this month</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.totalGames}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active players</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.totalPlayers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total volume</span>
                <span className="text-sm font-medium text-gray-900">
                  ${stats.totalVolume.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Settlements</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.totalSettlements}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
