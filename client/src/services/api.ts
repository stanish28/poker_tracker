import { 
  AuthResponse, 
  User, 
  Player, 
  PlayerStats, 
  Game, 
  GameWithPlayers, 
  CreateGameRequest, 
  GameStats,
  Settlement,
  CreateSettlementRequest,
  SettlementStats,
  PlayerDebts
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : '/api');

class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      // Log debugging headers for games endpoint
      if (endpoint.includes('/games') && !endpoint.includes('/test-filter')) {
        const debugPlayerId = response.headers.get('X-Debug-PlayerId');
        const debugPlayerGames = response.headers.get('X-Debug-PlayerGames');
        const debugFilteredGames = response.headers.get('X-Debug-FilteredGames');
        const debugQuery = response.headers.get('X-Debug-Query');
        
        console.log('🔍 Backend Debug Info:');
        console.log('  Player ID:', debugPlayerId);
        console.log('  Player Games Count:', debugPlayerGames);
        console.log('  Filtered Games Count:', debugFilteredGames);
        console.log('  Query:', debugQuery);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          errorData.error || errorData.message || 'Request failed',
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, 'Network error', error);
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  // Auth endpoints
  async login(username: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async verifyToken(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/verify');
  }

  // Player endpoints
  async getPlayers(): Promise<Player[]> {
    return this.request<Player[]>('/players');
  }

  async getPlayer(id: string): Promise<Player> {
    return this.request<Player>(`/players/${id}`);
  }

  async createPlayer(name: string): Promise<Player> {
    return this.request<Player>('/players', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updatePlayer(id: string, name: string): Promise<Player> {
    return this.request<Player>(`/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deletePlayer(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/players/${id}`, {
      method: 'DELETE',
    });
  }

  async getPlayerStats(id: string): Promise<PlayerStats> {
    return this.request<PlayerStats>(`/players/${id}/stats`);
  }

  // Game endpoints
  async getGames(playerId?: string): Promise<Game[]> {
    const params = playerId ? `?playerId=${playerId}` : '';
    console.log('API: getGames called with playerId:', playerId, 'URL:', `/games${params}`);
    const result = await this.request<any>(`/games${params}`);
    
    // Handle debug response
    if (result.debug) {
      console.log('🔍 Backend Debug Info (from response):');
      console.log('  Player ID:', result.debug.playerId);
      console.log('  Player Games Count:', result.debug.playerGamesCount);
      console.log('  Filtered Games Count:', result.debug.filteredGamesCount);
      console.log('  Is Filtered:', result.debug.isFiltered);
      console.log('  Timestamp:', result.debug.timestamp);
      console.log('API: getGames returned', result.games.length, 'games');
      return result.games;
    } else {
      console.log('API: getGames returned', result.length, 'games');
      return result;
    }
  }

  async getGame(id: string): Promise<GameWithPlayers> {
    return this.request<GameWithPlayers>(`/games/${id}`);
  }

  async createGame(gameData: CreateGameRequest): Promise<Game> {
    return this.request<Game>('/games', {
      method: 'POST',
      body: JSON.stringify(gameData),
    });
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game> {
    return this.request<Game>(`/games/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteGame(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/games/${id}`, {
      method: 'DELETE',
    });
  }

  async getGameStats(): Promise<GameStats> {
    return this.request<GameStats>('/games/stats/overview');
  }

  // Settlement endpoints
  async getSettlements(): Promise<Settlement[]> {
    return this.request<Settlement[]>('/settlements');
  }

  async getSettlement(id: string): Promise<Settlement> {
    return this.request<Settlement>(`/settlements/${id}`);
  }

  async getPlayerNetProfit(playerId: string): Promise<{
    player_id: string;
    game_net_profit: number;
    settlement_impact: number;
    true_net_profit: number;
    settlements_count: number;
  }> {
    return this.request(`/players/${playerId}/net-profit`);
  }

  async getAllPlayersNetProfit(): Promise<{
    player_id: string;
    game_net_profit: number;
    settlement_impact: number;
    true_net_profit: number;
    settlements_count: number;
  }[]> {
    return this.request('/players/net-profit/bulk');
  }

  async createSettlement(settlementData: CreateSettlementRequest): Promise<Settlement> {
    return this.request<Settlement>('/settlements', {
      method: 'POST',
      body: JSON.stringify(settlementData),
    });
  }

  async updateSettlement(id: string, updates: Partial<Settlement>): Promise<Settlement> {
    return this.request<Settlement>(`/settlements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSettlement(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/settlements/${id}`, {
      method: 'DELETE',
    });
  }

  async getSettlementStats(): Promise<SettlementStats> {
    return this.request<SettlementStats>('/settlements/stats/overview');
  }

  // Discrepancy endpoint
  async getTotalDiscrepancy(): Promise<{
    total_positive_profit: number;
    total_negative_profit: number;
    total_discrepancy: number;
    is_balanced: boolean;
    players_count: number;
  }> {
    return this.request('/discrepancy/total');
  }

  async getPlayerDebts(playerId: string): Promise<PlayerDebts> {
    return this.request<PlayerDebts>(`/settlements/player/${playerId}/debts`);
  }

  // Bulk game creation endpoints
  async parseGameText(text: string, date?: string): Promise<{
    success: boolean;
    preview: {
      players: Array<{
        name: string;
        profit: number;
        buyin: number;
        cashout: number;
      }>;
      totalBuyins: number;
      totalCashouts: number;
      discrepancy: number;
      playerCount: number;
      gameDate: string;
    };
    matching: {
      matched: Array<{
        parsedName: string;
        existingPlayer: { id: string; name: string };
        similarity: number;
        profit: number;
      }>;
      unmatched: Array<{
        parsedName: string;
        profit: number;
        suggestions: Array<{ id: string; name: string; similarity: number }>;
      }>;
    };
    validation: {
      errors: string[];
      warnings: string[];
    };
  }> {
    return this.request('/bulk-game/parse', {
      method: 'POST',
      body: JSON.stringify({ text, date }),
    });
  }

  async createBulkGame(data: {
    date: string;
    players: Array<{
      name: string;
      profit: number;
      playerId?: string;
    }>;
    createNewPlayers?: boolean;
  }): Promise<{
    success: boolean;
    game: GameWithPlayers;
    newPlayersCreated: Array<{ id: string; name: string }>;
    summary: {
      totalPlayers: number;
      totalBuyins: number;
      totalCashouts: number;
      discrepancy: number;
      newPlayersCount: number;
    };
  }> {
    return this.request('/bulk-game/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBulkGamePlayers(): Promise<{
    success: boolean;
    players: Array<{ id: string; name: string }>;
  }> {
    return this.request('/bulk-game/players');
  }


  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; environment: string }> {
    return this.request('/health');
  }
}

export const apiService = new ApiService();
export { ApiError };
