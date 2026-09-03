import React, { useState, useMemo } from 'react';
import { X, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { Player, MergePreview } from '../../types';

interface MergePlayersModalProps {
  players: Player[];
  onClose: () => void;
  onMerged: () => void;
}

const currency = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;

/**
 * Fold duplicate player records into one.
 *
 * Duplicates arise because a ledger import creates a new player whenever a site
 * nickname does not match an existing name. The merge is irreversible, so the
 * flow is deliberately two-step: the server reports exactly what would change,
 * and only then is the merge offered.
 */
const MergePlayersModal: React.FC<MergePlayersModalProps> = ({ players, onClose, onMerged }) => {
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const sorted = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  const visible = useMemo(
    () =>
      search.trim()
        ? sorted.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
        : sorted,
    [sorted, search]
  );

  const target = players.find((p) => p.id === targetId) || null;

  const toggleSource = (id: string) => {
    setPreview(null);
    setError(null);
    setSourceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // Selecting a player as a source clears it as the target; the two roles are
    // mutually exclusive and the server rejects overlap anyway.
    if (targetId === id) setTargetId('');
  };

  const chooseTarget = (id: string) => {
    setPreview(null);
    setError(null);
    setTargetId(id);
    setSourceIds((prev) => prev.filter((x) => x !== id));
    const chosen = players.find((p) => p.id === id);
    if (chosen && !newName.trim()) setNewName(chosen.name);
  };

  const handlePreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPreview(await apiService.previewPlayerMerge(sourceIds, targetId));
    } catch (err: any) {
      setError(err.message || 'Could not preview the merge');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiService.mergePlayers(sourceIds, targetId, newName.trim());
      onMerged();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Merge failed');
      setIsLoading(false);
    }
  };

  const canPreview = sourceIds.length > 0 && !!targetId;
  const canMerge = canPreview && !!preview && !!newName.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Merge duplicate players</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <p className="text-sm text-gray-600">
            Pick the duplicate records to fold in, then the record to keep. Their
            games and settlements move to the kept record; the duplicates are
            deleted. This cannot be undone.
          </p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="input w-full"
          />

          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {visible.map((p) => {
              const isSource = sourceIds.includes(p.id);
              const isTarget = targetId === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 text-sm ${
                    isTarget ? 'bg-green-50' : isSource ? 'bg-amber-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="ml-2 text-gray-500">
                      {p.total_games} games
                      {p.email ? ` · ${p.email}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleSource(p.id)}
                      className={`btn btn-sm ${isSource ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {isSource ? 'Merging' : 'Merge in'}
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseTarget(p.id)}
                      className={`btn btn-sm ${isTarget ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {isTarget ? 'Keeping' : 'Keep'}
                    </button>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <p className="px-3 py-4 text-sm text-gray-500">No players match that search.</p>
            )}
          </div>

          {canPreview && (
            <div className="flex items-center flex-wrap gap-2 text-sm bg-gray-50 rounded-lg p-3">
              <span className="text-gray-700">
                {sourceIds
                  .map((id) => players.find((p) => p.id === id)?.name)
                  .filter(Boolean)
                  .join(', ')}
              </span>
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">{target?.name}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name for the merged player
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Aditya Soni"
              className="input w-full"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {preview && (
            <div className="border rounded-lg p-3 space-y-3 text-sm">
              <h3 className="font-medium text-gray-900">What will change</h3>
              <ul className="text-gray-700 space-y-1">
                <li>{preview.gameRowsMoving} game record(s) move to the kept player</li>
                <li>{preview.settlementsMoving} settlement(s) reassigned</li>
              </ul>

              {preview.collisions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center font-medium text-amber-800 mb-1">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {preview.collisions.length} game(s) contain more than one of these
                    players
                  </div>
                  <p className="text-amber-700">
                    Their rows will be combined into one, summing buy-ins and cash-outs.
                  </p>
                </div>
              )}

              {preview.selfSettlements.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center font-medium text-amber-800 mb-1">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {preview.selfSettlements.length} settlement(s) will be deleted
                  </div>
                  <p className="text-amber-700 mb-1">
                    These are payments between players being merged, which would become
                    payments to themselves:
                  </p>
                  <ul className="text-amber-700">
                    {preview.selfSettlements.map((s) => (
                      <li key={s.id}>
                        {s.from} → {s.to}: {currency(s.amount)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="font-medium text-gray-900 mb-1">Resulting totals</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-700">
                  <div>{preview.resultingTotals.total_games} games</div>
                  <div>{currency(preview.resultingTotals.total_buyins)} in</div>
                  <div>{currency(preview.resultingTotals.total_cashouts)} out</div>
                  <div
                    className={
                      preview.resultingTotals.net_profit >= 0
                        ? 'text-green-700'
                        : 'text-red-700'
                    }
                  >
                    {currency(preview.resultingTotals.net_profit)} net
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 p-4 border-t">
          <button onClick={onClose} className="btn btn-secondary btn-md">
            Cancel
          </button>
          <button
            onClick={handlePreview}
            disabled={!canPreview || isLoading}
            className="btn btn-secondary btn-md"
          >
            {isLoading && !preview ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Preview
          </button>
          <button
            onClick={handleMerge}
            disabled={!canMerge || isLoading}
            className="btn btn-danger btn-md"
            title={!preview ? 'Preview the merge first' : undefined}
          >
            {isLoading && preview ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Merge
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergePlayersModal;
