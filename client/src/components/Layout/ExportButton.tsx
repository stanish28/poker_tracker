import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

interface ExportButtonProps {
  dataset: 'games' | 'players' | 'settlements';
  label?: string;
}

/**
 * Downloads a CSV export of the given dataset.
 *
 * The download is a fetch rather than a link because the export endpoint sits
 * behind the auth gate; see apiService.downloadExport.
 */
const ExportButton: React.FC<ExportButtonProps> = ({ dataset, label = 'Export CSV' }) => {
  const { addToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await apiService.downloadExport(dataset);
      addToast('Export downloaded', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="btn btn-secondary btn-md w-full sm:w-auto"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {isExporting ? 'Exporting…' : label}
    </button>
  );
};

export default ExportButton;
