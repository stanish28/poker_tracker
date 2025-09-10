import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
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
    } catch (err) {
      setError('Failed to delete player');
      console.error('Delete player error:', err);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  const handlePlayerSaved = (savedPlayer: Player) => {
    if (editingPlayer) {
      setPlayers(prev => prev.map(p => p.id === savedPlayer.id ? savedPlayer : p));
    } else {
      setPlayers(prev => [...prev, savedPlayer]);
    }
    handleModalClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-success-600';
    if (profit < 0) return 'text-danger-600';
    return 'text-gray-600';
  };

  const getProfitIcon = (profit: number) => {
    if (profit > 0) return <TrendingUp className="h-4 w-4" />;
    if (profit < 0) return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading players..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Players</h1>
          <p className="mt-2 text-gray-600">Manage poker players and track their statistics</p>
        </div>
        <button
          onClick={handleCreatePlayer}
          className="btn btn-primary btn-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Player
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-md">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* Players Grid */}
      {players.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {players.map((player) => (
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
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <DollarSign className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No players yet</h3>
          <p className="text-gray-600 mb-6">Get started by adding your first player</p>
          <button
            onClick={handleCreatePlayer}
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Player
          </button>
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
