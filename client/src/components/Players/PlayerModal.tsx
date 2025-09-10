import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../../services/api';
import { Player } from '../../types';

interface PlayerModalProps {
  player: Player | null;
  onClose: () => void;
  onSave: (player: Player) => void;
}

const PlayerModal: React.FC<PlayerModalProps> = ({ player, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (player) {
      setFormData({ name: player.name });
    } else {
      setFormData({ name: '' });
    }
    setError(null);
  }, [player]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsLoading(true);
      setError(null);

      let savedPlayer: Player;
      if (player) {
        savedPlayer = await apiService.updatePlayer(player.id, formData.name.trim());
      } else {
        savedPlayer = await apiService.createPlayer(formData.name.trim());
      }

      onSave(savedPlayer);
    } catch (err: any) {
      setError(err.message || 'Failed to save player');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = formData.name.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {player ? 'Edit Player' : 'Add New Player'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-md">
              <p className="text-sm text-danger-600">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Player Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className="input"
              placeholder="Enter player name"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="flex justify-end space-x-3">
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
                  {player ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                player ? 'Update Player' : 'Create Player'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerModal;
