import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown, Search, X, RefreshCw, LineChart } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Player } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';
import PlayerModal from './PlayerModal';
import PlayerPerformanceModal from './PlayerPerformanceModal';

const Players: React.FC = () => {
  const { addToast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  /** Which player's full details are shown below the icon row (click same icon to close). */
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [performancePlayer, setPerformancePlayer] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'net_profit' | 'total_games'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [playerNetProfits, setPlayerNetProfits] = useState<Record<string, {
    game_net_profit: number;
    settlement_impact: number;
    true_net_profit: number;
    settlements_count: number;
  }>>({});
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getPlayers();
      setPlayers(data);
      
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
        data.forEach(player => {
          netProfitData[player.id] = {
            game_net_profit: parseFloat(String(player.net_profit || 0)),
            settlement_impact: 0,
            true_net_profit: parseFloat(String(player.net_profit || 0)),
            settlements_count: 0
          };
        });
        setPlayerNetProfits(netProfitData);
      }
    } catch (err) {
      setError('Failed to load players');
      console.error('Players error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlayer = () => {
    setEditingPlayer(null);
    setIsModalOpen(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setIsModalOpen(true);
  };

  const handleDeletePlayer = async (player: Player) => {
    if (!window.confirm(`Are you sure you want to delete ${player.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deletePlayer(player.id);
      setPlayers(prev => prev.filter(p => p.id !== player.id));
      setDetailPlayerId((current) => (current === player.id ? null : current));
      setError(null); // Clear any previous errors
    } catch (err: any) {
      if (err.message?.includes('game records')) {
        setError(`Cannot delete ${player.name} - they have game records. Remove them from all games first, or keep the player for historical data.`);
      } else {
        setError('Failed to delete player');
      }
      console.error('Delete player error:', err);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  const toggleDetailPanel = (playerId: string) => {
    setDetailPlayerId((prev) => (prev === playerId ? null : playerId));
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // Filter players based on search term
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = players;
    
    // Apply search filter
    if (searchTerm.trim()) {
      filtered = players.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'net_profit':
          aValue = playerNetProfits[a.id]?.true_net_profit || 0;
          bValue = playerNetProfits[b.id]?.true_net_profit || 0;
          break;
        case 'total_games':
          aValue = a.total_games || 0;
          bValue = b.total_games || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortBy === 'name') {
        // String comparison
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortOrder === 'asc' ? comparison : -comparison;
      } else {
        // Numeric comparison
        const comparison = (aValue as number) - (bValue as number);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
    });
  }, [players, searchTerm, sortBy, sortOrder, playerNetProfits]);

  useEffect(() => {
    if (
      detailPlayerId &&
      !filteredAndSortedPlayers.some((p) => p.id === detailPlayerId)
    ) {
      setDetailPlayerId(null);
    }
  }, [detailPlayerId, filteredAndSortedPlayers]);

  const handlePlayerSaved = (savedPlayer: Player) => {
    if (editingPlayer) {
      setPlayers(prev => prev.map(p => p.id === savedPlayer.id ? savedPlayer : p));
      addToast('Player updated', 'success');
    } else {
      setPlayers(prev => [...prev, savedPlayer]);
      addToast('Player added', 'success');
    }
    handleModalClose();
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount || 0);
  };

  const getProfitColor = (profit: number | string) => {
    const numProfit = typeof profit === 'string' ? parseFloat(profit) : profit;
    if (numProfit > 0) return 'text-success-600';
    if (numProfit < 0) return 'text-danger-600';
    return 'text-gray-600';
  };

  const getProfitIcon = (profit: number | string) => {
    const numProfit = typeof profit === 'string' ? parseFloat(profit) : profit;
    if (numProfit > 0) return <TrendingUp className="h-4 w-4" />;
    if (numProfit < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const getTrueNetProfit = (playerId: string) => {
    const netProfitData = playerNetProfits[playerId];
    return netProfitData ? netProfitData.true_net_profit : parseFloat(String(players.find(p => p.id === playerId)?.net_profit || 0));
  };

  const handleRecalculateStats = async () => {
    if (!window.confirm('This will recalculate all player statistics from game records. Continue?')) {
      return;
    }

    try {
      setIsRecalculating(true);
      setError(null);
      const result = await apiService.recalculateAllPlayerStats();
      
      // Refresh player data
      await fetchPlayers();
      
      alert(`Successfully recalculated statistics for ${result.updated} players!`);
    } catch (err: any) {
      setError('Failed to recalculate player statistics');
      console.error('Recalculate stats error:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading players..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Players</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Manage poker players and track their statistics
            {searchTerm && (
              <span className="text-primary-600"> • {filteredAndSortedPlayers.length} of {players.length} shown</span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
          <button
            onClick={handleRecalculateStats}
            className="btn btn-secondary btn-md w-full sm:w-auto"
            disabled={isRecalculating}
            title="Recalculate all player statistics from game records"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Recalculating...' : 'Sync Stats'}
          </button>
          <button
            onClick={handleCreatePlayer}
            className="btn btn-primary btn-md w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Player
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search players by name..."
          className="input pl-10 pr-10"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort by
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'net_profit' | 'total_games')}
            className="input"
          >
            <option value="name">Name</option>
            <option value="net_profit">Net Profit</option>
            <option value="total_games">Total Games</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order
          </label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="input"
          >
            <option value="asc">
              {sortBy === 'name' ? 'A-Z' : 'Low to High'}
            </option>
            <option value="desc">
              {sortBy === 'name' ? 'Z-A' : 'High to Low'}
            </option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-md">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* Players: name list + detail panel (accordion) */}
      {filteredAndSortedPlayers.length > 0 ? (
        <div className="space-y-4">
          <div className="card overflow-hidden p-0 sm:p-0">
            <div className="border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
              <p className="text-xs text-gray-500 sm:text-sm">
                Click a player&apos;s name to open their details. Click the same row again to close.
              </p>
            </div>
            <ul className="max-h-[min(50vh,28rem)] divide-y divide-gray-100 overflow-y-auto overscroll-contain sm:max-h-[min(55vh,32rem)]">
              {filteredAndSortedPlayers.map((player) => {
                const active = detailPlayerId === player.id;
                const profit = getTrueNetProfit(player.id);
                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => toggleDetailPanel(player.id)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 sm:px-5 sm:py-3.5 ${
                        active
                          ? 'bg-primary-50 text-gray-900'
                          : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span className="min-w-0 flex-1 font-medium sm:text-base">{player.name}</span>
                      <span
                        className={`flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums ${getProfitColor(profit)}`}
                      >
                        {getProfitIcon(profit)}
                        <span>{formatCurrency(profit)}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-gray-500 sm:min-w-[5rem] sm:text-sm">
                        <span className="sm:hidden">{player.total_games} g</span>
                        <span className="hidden sm:inline">{player.total_games} games</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {detailPlayerId &&
            (() => {
              const player = filteredAndSortedPlayers.find((p) => p.id === detailPlayerId);
              if (!player) return null;
              const net = playerNetProfits[player.id];
              return (
                <div className="card overflow-hidden slide-up">
                  <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900">{player.name}</h3>
                      <div className={`mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${getProfitColor(getTrueNetProfit(player.id))}`}>
                        <span className="flex items-center gap-1 font-medium">
                          {getProfitIcon(getTrueNetProfit(player.id))}
                          {formatCurrency(getTrueNetProfit(player.id))}
                        </span>
                        <span className="text-gray-500">· {player.total_games} games</span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setPerformancePlayer(player)}
                        className="btn btn-secondary btn-sm"
                        title="View playing curve"
                      >
                        <LineChart className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Curve</span>
                      </button>
                      <button type="button" onClick={() => handleEditPlayer(player)} className="btn btn-secondary btn-sm">
                        <Edit2 className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button type="button" onClick={() => handleDeletePlayer(player)} className="btn btn-danger btn-sm">
                        <Trash2 className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailPlayerId(null)}
                        className="btn btn-secondary btn-sm"
                        title="Close details"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">True Net Profit</span>
                      <div className={`flex items-center gap-1 ${getProfitColor(getTrueNetProfit(player.id))}`}>
                        {getProfitIcon(getTrueNetProfit(player.id))}
                        <span className="font-medium">{formatCurrency(getTrueNetProfit(player.id))}</span>
                      </div>
                    </div>

                    {net && net.settlements_count > 0 && (
                      <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-700">Settlement Impact</span>
                          <span className={`text-sm font-medium ${getProfitColor(net.settlement_impact)}`}>
                            {formatCurrency(net.settlement_impact)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-600">Game Net Profit</span>
                          <span className="text-xs text-gray-700">{formatCurrency(net.game_net_profit)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-600">Settlements</span>
                          <span className="text-xs text-gray-700">{net.settlements_count} transactions</span>
                        </div>
                        <p className="text-xs text-blue-600">
                          Paying a settlement increases net profit (debt cleared). Receiving decreases it (paid out).
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
                      <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
                        <span className="text-gray-600">Total Games</span>
                        <span className="font-medium text-gray-900">{player.total_games}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
                        <span className="text-gray-600">Buy-ins</span>
                        <span className="font-medium text-gray-900">{formatCurrency(player.total_buyins)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 col-span-2 lg:col-span-1">
                        <span className="text-gray-600">Cash-outs</span>
                        <span className="font-medium text-gray-900">{formatCurrency(player.total_cashouts)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                      <span>Joined</span>
                      <span>{new Date(player.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            {searchTerm ? (
              <Search className="h-12 w-12 mx-auto" />
            ) : (
              <DollarSign className="h-12 w-12 mx-auto" />
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? `No players found for "${searchTerm}"` : 'No players yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? (
              <>
                Try searching for a different name or{' '}
                <button 
                  onClick={clearSearch}
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  clear search
                </button>
              </>
            ) : (
              'Get started by adding your first player'
            )}
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreatePlayer}
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Player
            </button>
          )}
        </div>
      )}

      {/* Player Modal */}
      {isModalOpen && (
        <PlayerModal
          player={editingPlayer}
          onClose={handleModalClose}
          onSave={handlePlayerSaved}
        />
      )}

      {/* Player Performance (curve) Modal */}
      {performancePlayer && (
        <PlayerPerformanceModal
          player={performancePlayer}
          onClose={() => setPerformancePlayer(null)}
        />
      )}
    </div>
  );
};

export default Players;
