import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  Gamepad2,
  CreditCard,
  LogOut,
  User,
  Bell
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface ActivityFeedItem {
  id: string;
  type: 'game' | 'settlement';
  title: string;
  date: string;
  amount?: number;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    let cancelled = false;
    const fetchActivity = async () => {
      setActivityLoading(true);
      try {
        const [games, settlements] = await Promise.all([
          apiService.getGames(),
          apiService.getSettlements()
        ]);
        if (cancelled) return;
        const items: ActivityFeedItem[] = [
          ...games.slice(0, 5).map((g) => ({
            id: g.id,
            type: 'game' as const,
            title: `Game on ${new Date(g.date).toLocaleDateString()}`,
            date: g.date,
            amount: parseFloat(String(g.total_buyins || 0))
          })),
          ...settlements.slice(0, 5).map((s) => ({
            id: s.id,
            type: 'settlement' as const,
            title: `${s.from_player_name} → ${s.to_player_name}`,
            date: s.date,
            amount: parseFloat(String(s.amount || 0))
          }))
        ];
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecentActivity(items.slice(0, 10));
      } catch {
        if (!cancelled) setRecentActivity([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };
    fetchActivity();
    return () => {
      cancelled = true;
    };
  }, [isNotificationsOpen]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'settlements', label: 'Settlements', icon: CreditCard },
  ];

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and title */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Gamepad2 className="h-5 w-5 text-white" />
              </div>
              <h1 className="ml-3 text-xl font-bold text-gray-900 hidden sm:block">Poker Tracker</h1>
              <h1 className="ml-2 text-lg font-bold text-gray-900 sm:hidden">Poker</h1>
            </div>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`tab ${
                    activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Desktop: Notifications bell + User menu */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className="btn btn-secondary btn-sm p-2"
                title="Recent activity"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              {isNotificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-auto bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <div className="p-3 border-b border-gray-200 font-medium text-gray-900">
                      Recent activity
                    </div>
                    <div className="max-h-72 overflow-auto">
                      {activityLoading ? (
                        <div className="p-4 text-sm text-gray-500">Loading...</div>
                      ) : recentActivity.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">No recent activity</div>
                      ) : (
                        <ul className="py-1">
                          {recentActivity.map((item) => (
                            <li
                              key={`${item.type}-${item.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                              {item.type === 'game' ? (
                                <Gamepad2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              ) : (
                                <CreditCard className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-gray-900 truncate">{item.title}</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(item.date).toLocaleDateString()}
                                  {item.amount != null && ` · $${item.amount.toFixed(2)}`}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <User className="h-4 w-4" />
              <span>{user?.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </button>
          </div>

          {/* Mobile: Notifications + User menu */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsUserMenuOpen(false);
                setIsNotificationsOpen((prev) => !prev);
              }}
              className="btn btn-secondary btn-sm p-2"
              title="Recent activity"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setIsNotificationsOpen(false);
                setIsUserMenuOpen(!isUserMenuOpen);
              }}
              className="btn btn-secondary btn-sm p-2"
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile notifications dropdown */}
        {isNotificationsOpen && (
          <div className="md:hidden absolute left-4 right-4 top-16 z-20 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-200 font-medium text-gray-900">Recent activity</div>
            <div className="overflow-auto flex-1">
              {activityLoading ? (
                <div className="p-4 text-sm text-gray-500">Loading...</div>
              ) : recentActivity.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No recent activity</div>
              ) : (
                <ul className="py-1">
                  {recentActivity.map((item) => (
                    <li
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      {item.type === 'game' ? (
                        <Gamepad2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-gray-900 truncate">{item.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(item.date).toLocaleDateString()}
                          {item.amount != null && ` · $${item.amount.toFixed(2)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(false)}
              className="p-2 text-sm text-gray-600 border-t border-gray-200"
            >
              Close
            </button>
          </div>
        )}

        {/* Mobile User menu dropdown */}
        {isUserMenuOpen && (
          <div className="md:hidden absolute right-4 top-16 z-10 w-48 bg-white rounded-md shadow-lg border border-gray-200">
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  {user?.username}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile navigation tabs - always visible */}
      <div className="md:hidden bg-white border-t border-gray-200">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
