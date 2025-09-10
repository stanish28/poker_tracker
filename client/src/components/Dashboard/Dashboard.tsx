import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Gamepad2, 
  CreditCard, 
  DollarSign,
  Activity
} from 'lucide-react';
import { apiService } from '../../services/api';
import { DashboardStats } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [players, games, settlements, gameStats, settlementStats] = await Promise.all([
          apiService.getPlayers(),
          apiService.getGames(),
          apiService.getSettlements(),
          apiService.getGameStats(),
          apiService.getSettlementStats()
        ]);

        const totalVolume = gameStats.total_buyins + settlementStats.total_amount;
        
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
          totalPlayers: players.length,
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
