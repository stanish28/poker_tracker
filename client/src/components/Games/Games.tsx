import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { Game, Player } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';
import GameModal from './GameModal';
import GameDetailsModal from './GameDetailsModal';

const Games: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [gamesData, playersData] = await Promise.all([
        apiService.getGames(),
        apiService.getPlayers()
      ]);
      setGames(gamesData);
      setPlayers(playersData);
    } catch (err) {
      setError('Failed to load games');
      console.error('Games error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGame = () => {
    setEditingGame(null);
    setIsModalOpen(true);
  };

  const handleViewGame = (game: Game) => {
    setSelectedGame(game);
    setIsDetailsModalOpen(true);
  };

  const handleEditGame = (game: Game) => {
    setEditingGame(game);
    setIsModalOpen(true);
  };

  const handleDeleteGame = async (game: Game) => {
    if (!window.confirm(`Are you sure you want to delete the game from ${new Date(game.date).toLocaleDateString()}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiService.deleteGame(game.id);
      setGames(prev => prev.filter(g => g.id !== game.id));
    } catch (err) {
      setError('Failed to delete game');
      console.error('Delete game error:', err);
    }
  };

  const handleToggleComplete = async (game: Game) => {
    try {
      const updatedGame = await apiService.updateGame(game.id, { 
        is_completed: !game.is_completed 
      });
      setGames(prev => prev.map(g => g.id === game.id ? updatedGame : g));
    } catch (err) {
      setError('Failed to update game');
      console.error('Update game error:', err);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingGame(null);
  };

  const handleDetailsModalClose = () => {
    setIsDetailsModalOpen(false);
    setSelectedGame(null);
  };

  const handleGameSaved = (savedGame: Game) => {
    if (editingGame) {
      setGames(prev => prev.map(g => g.id === savedGame.id ? savedGame : g));
    } else {
      setGames(prev => [savedGame, ...prev]);
    }
    handleModalClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" text="Loading games..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Games</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Track poker game sessions and player participation</p>
        </div>
        <button
          onClick={handleCreateGame}
          className="btn btn-primary btn-md w-full sm:w-auto"
          disabled={players.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Game
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-md">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* No Players Warning */}
      {players.length === 0 && (
        <div className="p-4 bg-warning-50 border border-warning-200 rounded-md">
          <p className="text-sm text-warning-600">
            You need to add players before creating games. Go to the Players tab to add some players.
          </p>
        </div>
      )}

      {/* Games List */}
      {games.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block card">
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-head">Date</th>
                    <th className="table-head">Players</th>
                    <th className="table-head">Buy-ins</th>
                    <th className="table-head">Cash-outs</th>
                    <th className="table-head">Discrepancy</th>
                    <th className="table-head">Status</th>
                    <th className="table-head">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.id} className="table-row">
                      <td className="table-cell">
                        <div className="font-medium text-gray-900">
                          {formatDate(game.date)}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-sm text-gray-600">
                          {game.player_count || 0} players
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(game.total_buyins)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(game.total_cashouts)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`font-medium ${
                          game.discrepancy > 0 ? 'text-success-600' : 
                          game.discrepancy < 0 ? 'text-danger-600' : 'text-gray-600'
                        }`}>
                          {formatCurrency(game.discrepancy)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${
                          game.is_completed ? 'badge-success' : 'badge-warning'
                        }`}>
                          {game.is_completed ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewGame(game)}
                            className="btn btn-secondary btn-sm"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditGame(game)}
                            className="btn btn-secondary btn-sm"
                            title="Edit Game"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleComplete(game)}
                            className={`btn btn-sm ${
                              game.is_completed ? 'btn-warning' : 'btn-success'
                            }`}
                            title={game.is_completed ? 'Mark Incomplete' : 'Mark Complete'}
                          >
                            {game.is_completed ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteGame(game)}
                            className="btn btn-danger btn-sm"
                            title="Delete Game"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {games.map((game) => (
              <div key={game.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {formatDate(game.date)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {game.player_count || 0} players
                    </p>
                  </div>
                  <span className={`badge ${
                    game.is_completed ? 'badge-success' : 'badge-warning'
                  }`}>
                    {game.is_completed ? 'Completed' : 'In Progress'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-xs text-gray-500">Buy-ins</span>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(game.total_buyins)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Cash-outs</span>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(game.total_cashouts)}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-xs text-gray-500">Discrepancy</span>
                  <p className={`font-semibold ${
                    game.discrepancy > 0 ? 'text-success-600' : 
                    game.discrepancy < 0 ? 'text-danger-600' : 'text-gray-600'
                  }`}>
                    {formatCurrency(game.discrepancy)}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleViewGame(game)}
                    className="btn btn-secondary btn-sm flex-1 sm:flex-none"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </button>
                  <button
                    onClick={() => handleEditGame(game)}
                    className="btn btn-secondary btn-sm flex-1 sm:flex-none"
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleComplete(game)}
                    className={`btn btn-sm flex-1 sm:flex-none ${
                      game.is_completed ? 'btn-warning' : 'btn-success'
                    }`}
                  >
                    {game.is_completed ? (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteGame(game)}
                    className="btn btn-danger btn-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <CheckCircle className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No games yet</h3>
          <p className="text-gray-600 mb-6">
            {players.length === 0 
              ? 'Add some players first, then create your first game'
              : 'Get started by creating your first game'
            }
          </p>
          {players.length > 0 && (
            <button
              onClick={handleCreateGame}
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Game
            </button>
          )}
        </div>
      )}

      {/* Game Modal */}
      {isModalOpen && (
        <GameModal
          game={editingGame}
          players={players}
          onClose={handleModalClose}
          onSave={handleGameSaved}
        />
      )}

      {/* Game Details Modal */}
      {isDetailsModalOpen && selectedGame && (
        <GameDetailsModal
          game={selectedGame}
          onClose={handleDetailsModalClose}
        />
      )}
    </div>
  );
};

export default Games;
