import React, { useState, useEffect } from 'react';
import { X, DollarSign, Users, Calendar } from 'lucide-react';
import { apiService } from '../../services/api';
import { Game, GameWithPlayers } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';

interface GameDetailsModalProps {
  game: Game;
  onClose: () => void;
}

const GameDetailsModal: React.FC<GameDetailsModalProps> = ({ game, onClose }) => {
  const [gameDetails, setGameDetails] = useState<GameWithPlayers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const details = await apiService.getGame(game.id);
        setGameDetails(details);
      } catch (err) {
        setError('Failed to load game details');
        console.error('Game details error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameDetails();
  }, [game.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-success-600';
    if (profit < 0) return 'text-danger-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full slide-up">
          <div className="p-8">
            <LoadingSpinner size="lg" text="Loading game details..." />
          </div>
        </div>
      </div>
    );
  }

  if (error || !gameDetails) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full slide-up">
          <div className="p-8 text-center">
            <div className="text-danger-600 mb-4">
              <X className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button onClick={onClose} className="btn btn-primary btn-md">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Game Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Game Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Date</p>
                  <p className="stat-value text-lg">{formatDate(gameDetails.date)}</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Players</p>
                  <p className="stat-value text-lg">{gameDetails.players.length}</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Status</p>
                  <p className="stat-value text-lg">
                    <span className={`badge ${
                      gameDetails.is_completed ? 'badge-success' : 'badge-warning'
                    }`}>
                      {gameDetails.is_completed ? 'Completed' : 'In Progress'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="card mb-8">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Financial Summary</h3>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Total Buy-ins</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(gameDetails.total_buyins)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Total Cash-outs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(gameDetails.total_cashouts)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Discrepancy</p>
                  <p className={`text-2xl font-bold ${
                    gameDetails.discrepancy > 0 ? 'text-success-600' : 
                    gameDetails.discrepancy < 0 ? 'text-danger-600' : 'text-gray-600'
                  }`}>
                    {formatCurrency(gameDetails.discrepancy)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Player Results */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Player Results</h3>
            </div>
            <div className="card-content">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-head">Player</th>
                      <th className="table-head">Buy-in</th>
                      <th className="table-head">Cash-out</th>
                      <th className="table-head">Profit/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameDetails.players.map((player) => (
                      <tr key={player.id} className="table-row">
                        <td className="table-cell">
                          <span className="font-medium text-gray-900">
                            {player.player_name}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="text-gray-900">
                            {formatCurrency(player.buyin)}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="text-gray-900">
                            {formatCurrency(player.cashout)}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`font-medium ${getProfitColor(player.profit)}`}>
                            {formatCurrency(player.profit)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameDetailsModal;
