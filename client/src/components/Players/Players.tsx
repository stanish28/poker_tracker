import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { apiService } from '../../services/api';
import { Player } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';
import PlayerModal from './PlayerModal';

const Players: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiService.getPlayers();
      setPlayers(data);
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

  const togglePlayerDetails = (playerId: string) => {
    setExpandedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // Filter players based on search term
  const filteredPlayers = useMemo(() => {
    if (!searchTerm.trim()) {
      return players;
    }
    return players.filter(player =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [players, searchTerm]);

  const handlePlayerSaved = (savedPlayer: Player) => {
    if (editingPlayer) {
      setPlayers(prev => prev.map(p => p.id === savedPlayer.id ? savedPlayer : p));
    } else {
      setPlayers(prev => [...prev, savedPlayer]);
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
              <span className="text-primary-600"> • {filteredPlayers.length} of {players.length} shown</span>
            )}
          </p>
        </div>
        <button
          onClick={handleCreatePlayer}
          className="btn btn-primary btn-md w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Player
        </button>
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

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-md">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* Players List */}
      {filteredPlayers.length > 0 ? (
        <>
          {/* Desktop Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.map((player) => (
              <div key={player.id} className="card">
                <div className="card-content">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{player.name}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditPlayer(player)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(player)}
                        className="btn btn-danger btn-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Net Profit</span>
                      <div className={`flex items-center space-x-1 ${getProfitColor(player.net_profit)}`}>
                        {getProfitIcon(player.net_profit)}
                        <span className="font-medium">{formatCurrency(player.net_profit)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Games</span>
                      <span className="text-sm font-medium text-gray-900">{player.total_games}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Buy-ins</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(player.total_buyins)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Cash-outs</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(player.total_cashouts)}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Joined</span>
                        <span>{new Date(player.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Compact Bars */}
          <div className="md:hidden space-y-2">
            {filteredPlayers.map((player) => {
              const isExpanded = expandedPlayers.has(player.id);
              return (
                <div key={player.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  {/* Main Bar - Always Visible */}
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900 truncate">{player.name}</h3>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {player.total_games} games
                          </span>
                        </div>
                        <div className={`flex items-center space-x-1 ${getProfitColor(player.net_profit)}`}>
                          {getProfitIcon(player.net_profit)}
                          <span className="font-bold">{formatCurrency(player.net_profit)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-2">
                      <button
                        onClick={() => togglePlayerDetails(player.id)}
                        className="btn btn-secondary btn-sm p-2"
                        title={isExpanded ? 'Show Less' : 'Show Details'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEditPlayer(player)}
                        className="btn btn-secondary btn-sm p-2"
                        title="Edit Player"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(player)}
                        className="btn btn-danger btn-sm p-2"
                        title="Delete Player"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-100 animate-slide-up">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Buy-ins</span>
                          <p className="font-medium text-gray-900">
                            {formatCurrency(player.total_buyins)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Cash-outs</span>
                          <p className="font-medium text-gray-900">
                            {formatCurrency(player.total_cashouts)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                          Joined {new Date(player.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
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
    </div>
  );
};

export default Players;
