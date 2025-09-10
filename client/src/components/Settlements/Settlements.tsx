import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit2, Trash2, CreditCard, DollarSign } from 'lucide-react';
import { apiService } from '../../services/api';
import { Settlement, Player } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';
import SettlementModal from './SettlementModal';
import SettlementDetailsModal from './SettlementDetailsModal';

const Settlements: React.FC = () => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [settlementsData, playersData] = await Promise.all([
        apiService.getSettlements(),
        apiService.getPlayers()
      ]);
      setSettlements(settlementsData);
      setPlayers(playersData);
    } catch (err) {
      setError('Failed to load settlements');
      console.error('Settlements error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSettlement = () => {
    setEditingSettlement(null);
    setIsModalOpen(true);
  };

  const handleViewSettlement = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setIsDetailsModalOpen(true);
  };

  const handleEditSettlement = (settlement: Settlement) => {
    setEditingSettlement(settlement);
    setIsModalOpen(true);
  };

  const handleDeleteSettlement = async (settlement: Settlement) => {
    if (!window.confirm(`Are you sure you want to delete this settlement between ${settlement.from_player_name} and ${settlement.to_player_name}?`)) {
      return;
    }

    try {
      await apiService.deleteSettlement(settlement.id);
      setSettlements(prev => prev.filter(s => s.id !== settlement.id));
    } catch (err) {
      setError('Failed to delete settlement');
      console.error('Delete settlement error:', err);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingSettlement(null);
  };

  const handleDetailsModalClose = () => {
    setIsDetailsModalOpen(false);
    setSelectedSettlement(null);
  };

  const handleSettlementSaved = (savedSettlement: Settlement) => {
    if (editingSettlement) {
      setSettlements(prev => prev.map(s => s.id === savedSettlement.id ? savedSettlement : s));
    } else {
      setSettlements(prev => [savedSettlement, ...prev]);
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
    return <LoadingSpinner size="lg" text="Loading settlements..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settlements</h1>
          <p className="mt-2 text-gray-600">Track financial settlements between players</p>
        </div>
        <button
          onClick={handleCreateSettlement}
          className="btn btn-primary btn-md"
          disabled={players.length < 2}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Settlement
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-md">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* No Players Warning */}
      {players.length < 2 && (
        <div className="p-4 bg-warning-50 border border-warning-200 rounded-md">
          <p className="text-sm text-warning-600">
            You need at least 2 players to create settlements. Go to the Players tab to add more players.
          </p>
        </div>
      )}

      {/* Settlements Table */}
      {settlements.length > 0 ? (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-head">Date</th>
                  <th className="table-head">From</th>
                  <th className="table-head">To</th>
                  <th className="table-head">Amount</th>
                  <th className="table-head">Notes</th>
                  <th className="table-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((settlement) => (
                  <tr key={settlement.id} className="table-row">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">
                        {formatDate(settlement.date)}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {settlement.from_player_name}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-gray-900">
                        {settlement.to_player_name}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(settlement.amount)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-sm text-gray-600 truncate max-w-xs block">
                        {settlement.notes || '-'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewSettlement(settlement)}
                          className="btn btn-secondary btn-sm"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditSettlement(settlement)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Settlement"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSettlement(settlement)}
                          className="btn btn-danger btn-sm"
                          title="Delete Settlement"
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
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <CreditCard className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No settlements yet</h3>
          <p className="text-gray-600 mb-6">
            {players.length < 2 
              ? 'Add at least 2 players first, then create your first settlement'
              : 'Get started by creating your first settlement'
            }
          </p>
          {players.length >= 2 && (
            <button
              onClick={handleCreateSettlement}
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Settlement
            </button>
          )}
        </div>
      )}

      {/* Settlement Modal */}
      {isModalOpen && (
        <SettlementModal
          settlement={editingSettlement}
          players={players}
          onClose={handleModalClose}
          onSave={handleSettlementSaved}
        />
      )}

      {/* Settlement Details Modal */}
      {isDetailsModalOpen && selectedSettlement && (
        <SettlementDetailsModal
          settlement={selectedSettlement}
          onClose={handleDetailsModalClose}
        />
      )}
    </div>
  );
};

export default Settlements;
