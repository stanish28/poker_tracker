import React, { useState, useRef } from 'react';
import { X, Camera, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/api';

interface ScreenshotImportModalProps {
  onClose: () => void;
  onGameCreated: (game: any) => void;
}

const ScreenshotImportModal: React.FC<ScreenshotImportModalProps> = ({ onClose, onGameCreated }) => {
  const [step, setStep] = useState<'upload' | 'processing' | 'preview' | 'creating'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Parsed data from OCR
  const [parsedData, setParsedData] = useState<{
    preview: any;
    matching: any;
    validation: any;
  } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileFromDrop(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      // Directly handle the file without creating a fake event
      handleFileFromDrop(file);
    }
  };

  const handleFileFromDrop = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleProcessImage = async () => {
    if (!selectedFile) {
      setError('Please select an image file');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setStep('processing');

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('date', date);

      // Set a timeout for the API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        // Call OCR API with timeout
        const result = await apiService.processScreenshot(formData, controller.signal);
        clearTimeout(timeoutId);
        
        if (!result.success) {
          throw new Error('Failed to process image');
        }

        setParsedData(result);
        setStep('preview');
      } catch (abortError) {
        clearTimeout(timeoutId);
        if (abortError.name === 'AbortError') {
          throw new Error('OCR processing timed out. Please try with a smaller or clearer image.');
        }
        throw abortError;
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to process image';
      
      // Handle specific error cases
      if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
        errorMessage = 'OCR processing timed out. Please try with a smaller or clearer image.';
      } else if (err.message?.includes('ERR_CONNECTION_CLOSED')) {
        errorMessage = 'Connection lost during processing. Please try again with a smaller image.';
      } else if (err.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setError(errorMessage);
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGame = async () => {
    if (!parsedData) return;

    try {
      setIsLoading(true);
      setError(null);
      setStep('creating');

      // Prepare players data
      const players = parsedData.preview.players.map((player: any) => ({
        name: player.name,
        profit: player.profit,
        playerId: undefined // Will be handled by the backend
      }));

      const result = await apiService.createBulkGame({
        date: parsedData.preview.gameDate,
        players,
        createNewPlayers: true
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
      setStep('upload');
    } else if (step === 'creating') {
      setStep('preview');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Import Game from Screenshot</h3>
          <p className="text-sm text-gray-600 mb-3">
            Upload a screenshot of your game tally. The system will extract text using OCR and parse the data automatically.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">📸 Tips for better OCR results:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Ensure good lighting and clear, readable text</li>
              <li>• Keep the image under 2MB for faster processing</li>
              <li>• Crop the image to focus on the text area</li>
              <li>• Make sure text is horizontal and not rotated</li>
              <li>• Use format like "PlayerName: +Amount" or "PlayerName: -Amount"</li>
            </ul>
          </div>
        </div>

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
          Game Date
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Screenshot Upload
        </label>
        
        {!selectedFile ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">Upload Screenshot</p>
            <p className="text-sm text-gray-600 mb-4">
              Drag and drop an image here, or click to select
            </p>
            <p className="text-xs text-gray-500">
              Supports JPG, PNG, GIF up to 10MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={previewUrl || ''}
                alt="Screenshot preview"
                className="w-full h-64 object-contain border border-gray-200 rounded-lg"
              />
              <button
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                title="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{selectedFile.name}</span>
              <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>
        )}
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
          onClick={handleProcessImage}
          className="btn btn-primary"
          disabled={isLoading || !selectedFile}
        >
          {isLoading ? 'Processing...' : 'Process Image'}
        </button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center py-8">
      <div className="loading-spinner mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Image...</h3>
      <p className="text-sm text-gray-600 mb-4">Extracting text from your screenshot using OCR.</p>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-w-md mx-auto">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> OCR processing can take 10-30 seconds depending on image size and quality. 
          Please be patient and don't close this window.
        </p>
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
            Review the extracted data and make any necessary adjustments.
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
              {validation.errors.map((error: string, index: number) => (
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
              {validation.warnings.map((warning: string, index: number) => (
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
                <FileText className="h-4 w-4 text-warning-600 mr-1" />
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

        {/* Player Values */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Player Values</h4>
          <div className="space-y-2">
            {preview.players.map((player: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white">
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{player.name}</span>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="text-center">
                    <div className="text-gray-600 text-xs">Buy-in</div>
                    <div className="font-medium">${player.buyin.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-600 text-xs">Cash-out</div>
                    <div className="font-medium">${player.cashout.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-600 text-xs">Profit</div>
                    <div className={`font-medium ${
                      player.profit > 0 ? 'text-success-600' : 
                      player.profit < 0 ? 'text-danger-600' : 'text-gray-600'
                    }`}>
                      {player.profit >= 0 ? '+' : ''}${player.profit.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto slide-up">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Screenshot Import Game
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
          {step === 'upload' && renderUploadStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'creating' && renderCreatingStep()}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotImportModal;
