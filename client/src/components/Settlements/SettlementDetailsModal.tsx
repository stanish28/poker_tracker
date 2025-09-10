import React from 'react';
import { X, CreditCard, Calendar, User, DollarSign } from 'lucide-react';
import { Settlement } from '../../types';

interface SettlementDetailsModalProps {
  settlement: Settlement;
  onClose: () => void;
}

const SettlementDetailsModal: React.FC<SettlementDetailsModalProps> = ({ settlement, onClose }) => {
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Settlement Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Settlement Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Date</p>
                  <p className="stat-value text-lg">{formatDate(settlement.date)}</p>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="stat-label">Amount</p>
                  <p className="stat-value text-lg">{formatCurrency(settlement.amount)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Players Involved */}
          <div className="card mb-8">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Players Involved</h3>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="flex justify-center mb-2">
                    <User className="h-8 w-8 text-red-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">From</p>
                  <p className="font-semibold text-gray-900">{settlement.from_player_name}</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="flex justify-center mb-2">
                    <User className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-sm text-gray-600 mb-1">To</p>
                  <p className="font-semibold text-gray-900">{settlement.to_player_name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {settlement.notes && (
            <div className="card mb-8">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              </div>
              <div className="card-content">
                <p className="text-gray-700 whitespace-pre-wrap">{settlement.notes}</p>
              </div>
            </div>
          )}

          {/* Settlement Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Settlement Summary</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Settlement ID</span>
                  <span className="font-mono text-sm text-gray-900">{settlement.id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-600">Created</span>
                  <span className="text-gray-900">{formatDateTime(settlement.created_at)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Transaction</span>
                  <span className="text-gray-900">
                    {settlement.from_player_name} → {settlement.to_player_name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementDetailsModal;
