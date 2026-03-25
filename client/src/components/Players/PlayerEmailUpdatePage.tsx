import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { Player } from '../../types';
import LoadingSpinner from '../Layout/LoadingSpinner';

const expectedToken = process.env.REACT_APP_EMAIL_UPDATE_TOKEN || '';

/**
 * Hidden roster: open only via /email-updates/{REACT_APP_EMAIL_UPDATE_TOKEN}.
 * Requires an active app login (JWT) so player data stays behind auth.
 */
const PlayerEmailUpdatePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const tokenOk = Boolean(expectedToken) && token === expectedToken;

  const load = useCallback(async () => {
    if (!tokenOk || !isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiService.getPlayers();
      setPlayers(list);
      const d: Record<string, string> = {};
      list.forEach((p) => {
        d[p.id] = p.email ?? '';
      });
      setDrafts(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tokenOk]);

  useEffect(() => {
    load();
  }, [load]);

  const setEmailDraft = (id: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const saveRow = async (p: Player) => {
    const email = drafts[p.id] ?? '';
    setSavingId(p.id);
    setSavedId(null);
    setError(null);
    try {
      const updated = await apiService.updatePlayer(
        p.id,
        p.name,
        email.trim() || undefined
      );
      setPlayers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setDrafts((prev) => ({ ...prev, [updated.id]: updated.email ?? '' }));
      setSavedId(p.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  if (!tokenOk) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-gray-600 text-center max-w-md">
          This page is not available. Use the link you were given, or ask an admin to set{' '}
          <code className="text-sm bg-gray-200 px-1 rounded">REACT_APP_EMAIL_UPDATE_TOKEN</code> on
          the deployment.
        </p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-gray-700 text-center max-w-md">
          Log in to Poker Tracker in this browser first, then open this link again.
        </p>
        <Link to="/" className="text-primary-600 font-medium hover:underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Player emails</h1>
            <p className="text-sm text-gray-500 mt-1">
              Private link — not listed in the app menu. Changes save per row.
            </p>
          </div>
          <Link to="/" className="text-sm text-primary-600 hover:underline self-start sm:self-auto">
            Back to app
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="md" text="Loading players..." />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="email"
                        className="input w-full max-w-md"
                        value={drafts[p.id] ?? ''}
                        onChange={(e) => setEmailDraft(p.id, e.target.value)}
                        placeholder="No email"
                        disabled={savingId === p.id}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => saveRow(p)}
                        disabled={savingId === p.id}
                      >
                        {savingId === p.id ? 'Saving…' : savedId === p.id ? 'Saved' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {players.length === 0 && (
              <p className="p-6 text-center text-gray-500 text-sm">No players yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerEmailUpdatePage;
