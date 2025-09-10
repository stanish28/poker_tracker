// User types
export interface User {
  id: string;
  username: string;
  email: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

// Player types
export interface Player {
  id: string;
  name: string;
  net_profit: number;
  total_games: number;
  total_buyins: number;
  total_cashouts: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerStats extends Player {
  recentGames: RecentGame[];
  currentStreak: {
    count: number;
    type: 'winning' | 'losing';
  };
}

export interface RecentGame {
  id: string;
  date: string;
  is_completed: boolean;
  buyin: number;
  cashout: number;
  profit: number;
}

// Game types
export interface Game {
  id: string;
  date: string;
  total_buyins: number;
  total_cashouts: number;
  discrepancy: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  player_count?: number;
}

export interface GameWithPlayers extends Game {
  players: GamePlayer[];
}

export interface GamePlayer {
  id: string;
  player_id: string;
  player_name: string;
  buyin: number;
  cashout: number;
  profit: number;
}

export interface CreateGameRequest {
  date: string;
  players: {
    player_id: string;
    buyin: number;
    cashout: number;
  }[];
}

export interface GameStats {
  total_games: number;
  completed_games: number;
  total_buyins: number;
  total_cashouts: number;
  avg_discrepancy: number;
  last_game_date: string;
  recentGames: Game[];
}

// Settlement types
export interface Settlement {
  id: string;
  from_player_id: string;
  to_player_id: string;
  from_player_name: string;
  to_player_name: string;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
}

export interface CreateSettlementRequest {
  from_player_id: string;
  to_player_id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface SettlementStats {
  total_settlements: number;
  total_amount: number;
  avg_amount: number;
  last_settlement_date: string;
  recentSettlements: Settlement[];
  debtSummary: DebtSummary[];
}

export interface DebtSummary {
  name: string;
  net_debt: number;
}

export interface PlayerDebts {
  player: {
    id: string;
    name: string;
  };
  debtsOwed: Settlement[];
  debtsOwedTo: Settlement[];
  totalOwed: number;
  totalOwedTo: number;
  netDebt: number;
}

// API Response types
export interface ApiError {
  error: string;
  message?: string;
  errors?: Array<{
    msg: string;
    param: string;
    value: any;
  }>;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard types
export interface DashboardStats {
  totalPlayers: number;
  totalGames: number;
  totalSettlements: number;
  totalVolume: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'game' | 'settlement' | 'player';
  title: string;
  description: string;
  date: string;
  amount?: number;
}
