import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../../services/api';
import { Settlement, Player, CreateSettlementRequest } from '../../types';

interface SettlementModalProps {
  settlement: Settlement | null;
  players: Player[];
  onClose: () => void;
  onSave: (settlement: Settlement) => void;
}

const SettlementModal: React.FC<SettlementModalProps> = ({ settlement, players, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    from_player_id: '',
    to_player_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settlement) {
      setFormData({
        from_player_id: settlement.from_player_id,
        to_player_id: settlement.to_player_id,
        amount: settlement.amount.toString(),
        date: settlement.date,
        notes: settlement.notes || ''
      });
    } else {
      setFormData({
        from_player_id: '',
        to_player_id: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
    setError(null);
  }, [settlement]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.from_player_id || !formData.to_player_id || !formData.amount) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.from_player_id === formData.to_player_id) {
      setError('From and To players must be different');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const settlementData: CreateSettlementRequest = {
        from_player_id: formData.from_player_id,
        to_player_id: formData.to_player_id,
        amount: parseFloat(formData.amount),
        date: formData.date,
        notes: formData.notes.trim() || undefined
      };

      let savedSettlement: Settlement;
      if (settlement) {
        savedSettlement = await apiService.updateSettlement(settlement.id, settlementData);
      } else {
        savedSettlement = await apiService.createSettlement(settlementData);
      }

      onSave(savedSettlement);
    } catch (err: any) {
      setError(err.message || 'Failed to save settlement');
    } finally {
      setIsLoading(false);
    }
  };


  const isFormValid = formData.from_player_id && formData.to_player_id && 
                     formData.amount && formData.from_player_id !== formData.to_player_id;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {settlement ? 'Edit Settlement' : 'Create New Settlement'}
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

          {/* From Player */}
          <div className="mb-4">
            <label htmlFor="from_player_id" className="block text-sm font-medium text-gray-700 mb-2">
              From Player *
            </label>
            <select
              id="from_player_id"
              name="from_player_id"
              required
              value={formData.from_player_id}
              onChange={handleChange}
              className="input"
              disabled={isLoading}
            >
              <option value="">Select a player</option>
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Player */}
          <div className="mb-4">
            <label htmlFor="to_player_id" className="block text-sm font-medium text-gray-700 mb-2">
              To Player *
            </label>
            <select
              id="to_player_id"
              name="to_player_id"
              required
              value={formData.to_player_id}
              onChange={handleChange}
              className="input"
              disabled={isLoading}
            >
              <option value="">Select a player</option>
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="mb-4">
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount ($) *
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={handleChange}
              className="input"
              placeholder="0.00"
              disabled={isLoading}
            />
          </div>

          {/* Date */}
          <div className="mb-4">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              value={formData.date}
              onChange={handleChange}
              className="input"
              disabled={isLoading}
            />
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              className="input"
              placeholder="Add any notes about this settlement..."
              disabled={isLoading}
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
                  {settlement ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                settlement ? 'Update Settlement' : 'Create Settlement'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettlementModal;
