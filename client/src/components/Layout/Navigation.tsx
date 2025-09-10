import React, { useState } from 'react';
import { 
  BarChart3, 
  Users, 
  Gamepad2, 
  CreditCard, 
  LogOut, 
  User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'games', label: 'Games', icon: Gamepad2 },
    { id: 'settlements', label: 'Settlements', icon: CreditCard },
  ];

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    setIsUserMenuOpen(false);
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

          {/* Desktop User menu */}
          <div className="hidden md:flex items-center space-x-4">
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

          {/* Mobile User menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="btn btn-secondary btn-sm"
            >
              <User className="h-4 w-4" />
            </button>
          </div>
        </div>

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
