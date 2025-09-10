import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Search } from 'lucide-react';
import { apiService } from '../../services/api';
import { Game, Player, CreateGameRequest } from '../../types';
import PlayerSelector from './PlayerSelector';

interface GameModalProps {
  game: Game | null;
  players: Player[];
  onClose: () => void;
  onSave: (game: Game) => void;
}

interface GamePlayer {
  player_id: string;
  buyin: number;
  cashout: number;
}

const GameModal: React.FC<GameModalProps> = ({ game, players, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    players: [] as GamePlayer[]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlayerSelectorOpen, setIsPlayerSelectorOpen] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');

  useEffect(() => {
    if (game) {
      // For editing, we'd need to fetch the full game details
      setFormData({
        date: game.date,
        players: []
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        players: []
      });
    }
    setError(null);
  }, [game]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, date: e.target.value }));
    if (error) setError(null);
  };

  const handleAddPlayer = () => {
    setIsPlayerSelectorOpen(true);
  };

  const handlePlayersSelected = (selectedPlayerIds: string[]) => {
    const newPlayers = selectedPlayerIds.map(playerId => ({
      player_id: playerId,
      buyin: 0,
      cashout: 0
    }));

    setFormData(prev => ({
      ...prev,
      players: [...prev.players, ...newPlayers]
    }));
  };

  const handleRemovePlayer = (index: number) => {
    setFormData(prev => ({
      ...prev,
      players: prev.players.filter((_, i) => i !== index)
    }));
  };

  const handlePlayerChange = (index: number, field: keyof GamePlayer, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      players: prev.players.map((gp, i) => 
        i === index ? { ...gp, [field]: value } : gp
      )
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.players.length === 0) {
      setError('Please add at least one player');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const gameData: CreateGameRequest = {
        date: formData.date,
        players: formData.players.map(gp => ({
          player_id: gp.player_id,
          buyin: parseFloat(gp.buyin.toString()),
          cashout: parseFloat(gp.cashout.toString())
        }))
      };

      const savedGame = await apiService.createGame(gameData);
      onSave(savedGame);
    } catch (err: any) {
      setError(err.message || 'Failed to save game');
    } finally {
      setIsLoading(false);
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : 'Unknown Player';
  };

  const getAvailablePlayers = () => {
    return players.filter(p => 
      !formData.players.some(gp => gp.player_id === p.id)
    );
  };

  const clearPlayerSearch = () => {
    setPlayerSearchTerm('');
  };

  // Filter added players based on search term
  const filteredGamePlayers = useMemo(() => {
    if (!playerSearchTerm.trim()) {
      return formData.players;
    }
    return formData.players.filter(gamePlayer => {
      const playerName = getPlayerName(gamePlayer.player_id);
      return playerName.toLowerCase().includes(playerSearchTerm.toLowerCase());
    });
  }, [formData.players, playerSearchTerm]);

  const totalBuyins = formData.players.reduce((sum, gp) => sum + parseFloat(gp.buyin.toString()), 0);
  const totalCashouts = formData.players.reduce((sum, gp) => sum + parseFloat(gp.cashout.toString()), 0);
  const discrepancy = totalCashouts - totalBuyins;

  const isFormValid = formData.players.length > 0 && formData.players.every(gp => 
    gp.player_id && gp.buyin >= 0 && gp.cashout >= 0
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {game ? 'Edit Game' : 'Create New Game'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-md">
              <p className="text-sm text-danger-600">{error}</p>
            </div>
          )}

          {/* Date */}
          <div className="mb-6">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Game Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              value={formData.date}
              onChange={handleDateChange}
              className="input"
              disabled={isLoading}
            />
          </div>

          {/* Players */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Players ({formData.players.length})
                {playerSearchTerm && (
                  <span className="text-primary-600 text-xs"> • {filteredGamePlayers.length} shown</span>
                )}
              </label>
              <button
                type="button"
                onClick={handleAddPlayer}
                className="btn btn-primary btn-sm"
                disabled={isLoading || getAvailablePlayers().length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Player
              </button>
            </div>

            {/* Search Bar for Added Players */}
            {formData.players.length > 3 && (
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={playerSearchTerm}
                  onChange={(e) => setPlayerSearchTerm(e.target.value)}
                  placeholder="Search added players..."
                  className="input pl-10 pr-10 text-sm"
                />
                {playerSearchTerm && (
                  <button
                    type="button"
                    onClick={clearPlayerSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            )}

            {formData.players.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No players added yet. Click "Add Player" to get started.</p>
              </div>
            ) : filteredGamePlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No players found for "{playerSearchTerm}"</p>
                <button 
                  type="button"
                  onClick={clearPlayerSearch}
                  className="text-primary-600 hover:text-primary-700 underline text-sm mt-2"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGamePlayers.map((gamePlayer, originalIndex) => {
                  const index = formData.players.findIndex(gp => gp.player_id === gamePlayer.player_id);
                  return (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium text-gray-900">
                        {getPlayerName(gamePlayer.player_id)}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(index)}
                        className="btn btn-danger btn-sm"
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Buy-in ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={gamePlayer.buyin}
                          onChange={(e) => handlePlayerChange(index, 'buyin', parseFloat(e.target.value) || 0)}
                          className="input"
                          disabled={isLoading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cash-out ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={gamePlayer.cashout}
                          onChange={(e) => handlePlayerChange(index, 'cashout', parseFloat(e.target.value) || 0)}
                          className="input"
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          {formData.players.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Game Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Buy-ins:</span>
                  <span className="ml-2 font-medium">${totalBuyins.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Cash-outs:</span>
                  <span className="ml-2 font-medium">${totalCashouts.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Discrepancy:</span>
                  <span className={`ml-2 font-medium ${
                    discrepancy > 0 ? 'text-success-600' : 
                    discrepancy < 0 ? 'text-danger-600' : 'text-gray-600'
                  }`}>
                    ${discrepancy.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-md"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="btn btn-primary btn-md"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="loading-spinner mr-2" />
                  Creating...
                </div>
              ) : (
                'Create Game'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Player Selector Modal */}
      {isPlayerSelectorOpen && (
        <PlayerSelector
          availablePlayers={getAvailablePlayers()}
          onPlayersSelected={handlePlayersSelected}
          onClose={() => setIsPlayerSelectorOpen(false)}
        />
      )}
    </div>
  );
};

export default GameModal;
