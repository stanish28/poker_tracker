import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Player } from '../../types';

interface PlayerSelectorProps {
  availablePlayers: Player[];
  onPlayersSelected: (playerIds: string[]) => void;
  onClose: () => void;
}

const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  availablePlayers,
  onPlayersSelected,
  onClose
}) => {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  const handlePlayerToggle = (playerId: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleSelectAll = () => {
    setSelectedPlayerIds(availablePlayers.map(p => p.id));
  };

  const handleClearAll = () => {
    setSelectedPlayerIds([]);
  };

  const handleConfirm = () => {
    onPlayersSelected(selectedPlayerIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden slide-up">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Select Players to Add
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4">
          {availablePlayers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>All players have been added to this game.</p>
            </div>
          ) : (
            <>
              {/* Select All / Clear All buttons */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  disabled={selectedPlayerIds.length === availablePlayers.length}
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAll}
                  className="text-sm text-gray-600 hover:text-gray-700 font-medium"
                  disabled={selectedPlayerIds.length === 0}
                >
                  Clear All
                </button>
              </div>

              {/* Player list */}
              <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto">
                {availablePlayers.map((player) => (
                  <label
                    key={player.id}
                    className="flex items-center p-2 sm:p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => handlePlayerToggle(player.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {player.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.total_games} games • Net: ${player.net_profit.toFixed(2)}
                      </div>
                    </div>
                    {selectedPlayerIds.includes(player.id) && (
                      <Check className="h-4 w-4 text-primary-600" />
                    )}
                  </label>
                ))}
              </div>

              {/* Selected count */}
              <div className="mt-4 text-sm text-gray-600">
                {selectedPlayerIds.length} player{selectedPlayerIds.length !== 1 ? 's' : ''} selected
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedPlayerIds.length === 0}
            className="btn btn-primary btn-sm"
          >
            Add {selectedPlayerIds.length} Player{selectedPlayerIds.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerSelector;
