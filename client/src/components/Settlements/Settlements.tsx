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
      console.log('💰 Fetched settlements:', settlementsData);
      console.log('💰 Fetched players:', playersData);
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
    console.log('💰 Settlement saved:', savedSettlement);
    console.log('💰 Settlement data structure:', {
      id: savedSettlement.id,
      amount: savedSettlement.amount,
      date: savedSettlement.date,
      from_player_name: savedSettlement.from_player_name,
      to_player_name: savedSettlement.to_player_name,
      notes: savedSettlement.notes
    });
    
    if (editingSettlement) {
      setSettlements(prev => prev.map(s => s.id === savedSettlement.id ? savedSettlement : s));
    } else {
      setSettlements(prev => [savedSettlement, ...prev]);
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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date';
    
    // Try to parse the date string
    let date: Date;
    
    // Handle different date formats
    if (dateString.includes('T')) {
      // ISO string format
      date = new Date(dateString);
    } else if (dateString.includes('-')) {
      // YYYY-MM-DD format
      date = new Date(dateString + 'T00:00:00');
    } else {
      // Try direct parsing
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settlements</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">Track financial settlements between players</p>
        </div>
        <button
          onClick={handleCreateSettlement}
          className="btn btn-primary btn-md w-full sm:w-auto"
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

      {/* Settlements List */}
      {settlements.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block card">
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

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {settlements.map((settlement) => (
              <div key={settlement.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {formatDate(settlement.date)}
                    </h3>
                    <div className="text-lg font-bold text-primary-600">
                      {formatCurrency(settlement.amount)}
                    </div>
                  </div>
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
                </div>

                {/* Payment Flow */}
                <div className="flex items-center justify-center mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {settlement.from_player_name}
                      </div>
                      <div className="text-xs text-gray-500">From</div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-8 h-px bg-gray-300"></div>
                      <DollarSign className="h-4 w-4 text-primary-600 mx-1" />
                      <div className="w-8 h-px bg-gray-300"></div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {settlement.to_player_name}
                      </div>
                      <div className="text-xs text-gray-500">To</div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {settlement.notes && (
                  <div className="mb-3">
                    <span className="text-xs text-gray-500">Notes</span>
                    <p className="text-sm text-gray-700 mt-1">
                      {settlement.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
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
