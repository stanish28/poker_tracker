import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, UserPlus, Users } from 'lucide-react';
import { apiService } from '../../services/api';

interface BulkGameModalProps {
  onClose: () => void;
  onGameCreated: (game: any) => void;
}

interface ParsedPlayer {
  name: string;
  profit: number;
  buyin: number;
  cashout: number;
  playerId?: string;
  isMatched?: boolean;
  suggestions?: Array<{ id: string; name: string; similarity: number }>;
}

const BulkGameModal: React.FC<BulkGameModalProps> = ({ onClose, onGameCreated }) => {
  const [step, setStep] = useState<'input' | 'preview' | 'creating'>('input');
  const [text, setText] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Parsed data
  const [parsedData, setParsedData] = useState<{
    preview: any;
    matching: any;
    validation: any;
  } | null>(null);
  
  // Player matching state
  const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({});
  const [createNewPlayers, setCreateNewPlayers] = useState(true);

  useEffect(() => {
    if (step === 'preview' && parsedData) {
      // Initialize player mappings for matched players
      const mappings: Record<string, string> = {};
      parsedData.matching.matched.forEach((match: any) => {
        mappings[match.parsedName] = match.existingPlayer.id;
      });
      setPlayerMappings(mappings);
    }
  }, [step, parsedData]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Please enter some text to parse');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const result = await apiService.parseGameText(text, date);
      
      if (!result.success) {
        throw new Error('Failed to parse text');
      }

      setParsedData(result);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse text');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayerMappingChange = (parsedName: string, playerId: string) => {
    setPlayerMappings(prev => ({
      ...prev,
      [parsedName]: playerId
    }));
  };

  const handleCreateGame = async () => {
    if (!parsedData) return;

    try {
      setIsLoading(true);
      setError(null);
      setStep('creating');

      // Prepare players data
      const players = parsedData.preview.players.map((player: ParsedPlayer) => ({
        name: player.name,
        profit: player.profit,
        playerId: playerMappings[player.name] || undefined
      }));

      const result = await apiService.createBulkGame({
        date: parsedData.preview.gameDate,
        players,
        createNewPlayers
      });

      if (result.success) {
        onGameCreated(result.game);
        onClose();
      } else {
        throw new Error('Failed to create game');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create game');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'preview') {
      setStep('input');
    } else if (step === 'creating') {
      setStep('preview');
    }
  };

  const renderInputStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Parse Game Data</h3>
        <p className="text-sm text-gray-600">
          Paste your notes app data or game tally. The system will automatically parse player names and profit/loss amounts.
        </p>
      </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
          Game Date
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={handleDateChange}
          className="input"
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
          Game Data
        </label>
        <textarea
          id="text"
          rows={8}
          value={text}
          onChange={handleTextChange}
          placeholder="Paste your game data here, e.g.:
Ishan: +75
Jayeesh: -40
Nivaan: -30
Heaansh: -35
Gurshaan: +40
Akhil: -10.5"
          className="input resize-none"
          disabled={isLoading}
        />
        <p className="text-xs text-gray-500 mt-1">
          Format: PlayerName: +/-Amount (one per line)
        </p>
      </div>

      {error && (
        <div className="p-3 bg-danger-50 border border-danger-200 rounded-md">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleParse}
          className="btn btn-primary"
          disabled={isLoading || !text.trim()}
        >
          {isLoading ? 'Parsing...' : 'Parse & Preview'}
        </button>
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    if (!parsedData) return null;

    const { preview, matching, validation } = parsedData;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Game</h3>
          <p className="text-sm text-gray-600">
            Review the parsed data and match players to existing ones.
          </p>
        </div>

        {/* Validation Messages */}
        {validation.errors.length > 0 && (
          <div className="p-3 bg-danger-50 border border-danger-200 rounded-md">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-4 w-4 text-danger-600 mr-2" />
              <span className="text-sm font-medium text-danger-800">Errors</span>
            </div>
            <ul className="text-sm text-danger-700 list-disc list-inside">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-sm font-medium text-yellow-800">Warnings</span>
            </div>
            <ul className="text-sm text-yellow-700 list-disc list-inside">
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Game Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Game Summary</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Players:</span>
              <span className="ml-2 font-medium">{preview.playerCount}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Buy-ins:</span>
              <span className="ml-2 font-medium">${preview.totalBuyins.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Cash-outs:</span>
              <span className="ml-2 font-medium">${preview.totalCashouts.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Discrepancy:</span>
              <span className={`ml-2 font-medium ${
                preview.discrepancy > 0 ? 'text-success-600' : 
                preview.discrepancy < 0 ? 'text-danger-600' : 'text-gray-600'
              }`}>
                ${preview.discrepancy.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Player Matching */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Player Matching</h4>
          
          {/* Matched Players */}
          {matching.matched.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <CheckCircle className="h-4 w-4 text-success-600 mr-1" />
                Matched Players ({matching.matched.length})
              </h5>
              <div className="space-y-2">
                {matching.matched.map((match: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-success-50 border border-success-200 rounded">
                    <span className="text-sm font-medium">{match.parsedName}</span>
                    <span className="text-sm text-success-600">
                      → {match.existingPlayer.name} ({Math.round(match.similarity * 100)}% match)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched Players */}
          {matching.unmatched.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <UserPlus className="h-4 w-4 text-warning-600 mr-1" />
                New Players ({matching.unmatched.length})
              </h5>
              <div className="space-y-2">
                {matching.unmatched.map((unmatched: any, index: number) => (
                  <div key={index} className="p-2 bg-warning-50 border border-warning-200 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{unmatched.parsedName}</span>
                      <span className="text-sm text-gray-600">
                        Profit: {unmatched.profit >= 0 ? '+' : ''}{unmatched.profit}
                      </span>
                    </div>
                    {unmatched.suggestions.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Similar: {unmatched.suggestions.map((s: any) => s.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="createNewPlayers"
            checked={createNewPlayers}
            onChange={(e) => setCreateNewPlayers(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="createNewPlayers" className="text-sm text-gray-700">
            Automatically create new players if they don't exist
          </label>
        </div>

        {error && (
          <div className="p-3 bg-danger-50 border border-danger-200 rounded-md">
            <p className="text-sm text-danger-600">{error}</p>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleCreateGame}
            className="btn btn-primary"
            disabled={isLoading || validation.errors.length > 0}
          >
            Create Game
          </button>
        </div>
      </div>
    );
  };

  const renderCreatingStep = () => (
    <div className="text-center py-8">
      <div className="loading-spinner mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Creating Game...</h3>
      <p className="text-sm text-gray-600">Please wait while we create the game and update player statistics.</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Bulk Game Creation
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {step === 'input' && renderInputStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'creating' && renderCreatingStep()}
        </div>
      </div>
    </div>
  );
};

export default BulkGameModal;
