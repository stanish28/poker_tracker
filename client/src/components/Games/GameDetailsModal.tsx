import React, { useState, useEffect } from 'react';
import { X, DollarSign, Users, TrendingUp, TrendingDown, Award, Target } from 'lucide-react';
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

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
    return <Target className="h-4 w-4" />;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-blue-50">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Game Details</h2>
            <p className="text-sm text-gray-600 mt-1">{formatDate(gameDetails.date)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {/* Game Status Badge */}
          <div className="flex justify-center mb-6">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
              gameDetails.is_completed 
                ? 'bg-success-100 text-success-800' 
                : 'bg-warning-100 text-warning-800'
            }`}>
              <Award className="h-4 w-4 mr-2" />
              {gameDetails.is_completed ? 'Game Completed' : 'Game In Progress'}
            </span>
          </div>

          {/* Game Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="stat-card text-center">
              <div className="p-3 bg-green-100 rounded-lg mx-auto w-fit mb-3">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <p className="stat-label">Players</p>
              <p className="stat-value text-xl sm:text-2xl">{gameDetails.players.length}</p>
            </div>

            <div className="stat-card text-center">
              <div className="p-3 bg-blue-100 rounded-lg mx-auto w-fit mb-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <p className="stat-label">Total Pot</p>
              <p className="stat-value text-xl sm:text-2xl">{formatCurrency(gameDetails.total_buyins)}</p>
            </div>

            <div className="stat-card text-center col-span-2 sm:col-span-1">
              <div className={`p-3 rounded-lg mx-auto w-fit mb-3 ${
                parseFloat(String(gameDetails.discrepancy || 0)) > 0 ? 'bg-success-100' :
                parseFloat(String(gameDetails.discrepancy || 0)) < 0 ? 'bg-danger-100' : 'bg-gray-100'
              }`}>
                {getProfitIcon(gameDetails.discrepancy)}
              </div>
              <p className="stat-label">Discrepancy</p>
              <p className={`stat-value text-xl sm:text-2xl ${getProfitColor(gameDetails.discrepancy)}`}>
                {formatCurrency(gameDetails.discrepancy)}
              </p>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Financial Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Buy-ins</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(gameDetails.total_buyins)}
                    </p>
                    <p className="text-xs text-gray-500">Money in</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Cash-outs</span>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(gameDetails.total_cashouts)}
                    </p>
                    <p className="text-xs text-gray-500">Money out</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Player Results */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Player Results</h3>
            
            {/* Desktop Table */}
            <div className="hidden md:block card">
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
                            <div className="flex items-center">
                              {getProfitIcon(player.profit)}
                              <span className={`font-medium ml-1 ${getProfitColor(player.profit)}`}>
                                {formatCurrency(player.profit)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {gameDetails.players
                .sort((a, b) => parseFloat(String(b.profit || 0)) - parseFloat(String(a.profit || 0)))
                .map((player) => (
                <div key={player.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-900 text-lg">{player.player_name}</h4>
                    <div className={`flex items-center space-x-1 ${getProfitColor(player.profit)}`}>
                      {getProfitIcon(player.profit)}
                      <span className="font-bold text-lg">{formatCurrency(player.profit)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Buy-in</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(player.buyin)}</p>
                    </div>
                    <div className="text-center bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Cash-out</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(player.cashout)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameDetailsModal;
