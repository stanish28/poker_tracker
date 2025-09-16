const { v4: uuidv4 } = require('uuid');

/**
 * Parse text to extract player names and profit/loss amounts
 * Handles various formats like:
 * - "PlayerName: +100"
 * - "PlayerName: -50"
 * - "PlayerName +100"
 * - "PlayerName -50.5"
 */
class TextParser {
  constructor() {
    // Common patterns for parsing
    this.patterns = [
      // Format: "Name: +amount" or "Name: -amount"
      /^([^:]+):\s*([+-]?\d+(?:\.\d+)?)$/,
      // Format: "Name +amount" or "Name -amount" (no colon)
      /^([^+\-]+)\s+([+-]?\d+(?:\.\d+)?)$/,
      // Format: "Name: amount" (no sign, assume positive if no sign)
      /^([^:]+):\s*(\d+(?:\.\d+)?)$/,
      // Format: "Name amount" (no sign, assume positive if no sign)
      /^([^+\-]+)\s+(\d+(?:\.\d+)?)$/
    ];
  }

  /**
   * Parse text input and extract player data
   * @param {string} text - Raw text input
   * @returns {Array} Array of {name, profit} objects
   */
  parseText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const players = [];

    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (parsed) {
        players.push(parsed);
      }
    }

    return players;
  }

  /**
   * Parse a single line to extract name and profit
   * @param {string} line - Single line of text
   * @returns {Object|null} {name, profit} or null if parsing fails
   */
  parseLine(line) {
    for (const pattern of this.patterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1].trim();
        let amount = parseFloat(match[2]);
        
        // If no sign is provided, assume it's positive
        if (isNaN(amount)) {
          return null;
        }

        return {
          name: name,
          profit: amount
        };
      }
    }

    return null;
  }

  /**
   * Convert profit/loss to buy-in/cash-out based on the rules:
   * - Profit (+): buyin = 0, cashout = profit
   * - Loss (-): buyin = |loss|, cashout = 0
   * @param {number} profit - Profit/loss amount
   * @returns {Object} {buyin, cashout}
   */
  convertProfitToBuyinCashout(profit) {
    if (profit >= 0) {
      // Profit: buyin = 0, cashout = profit
      return {
        buyin: 0,
        cashout: profit
      };
    } else {
      // Loss: buyin = |loss|, cashout = 0
      return {
        buyin: Math.abs(profit),
        cashout: 0
      };
    }
  }

  /**
   * Validate parsed data
   * @param {Array} players - Array of parsed player data
   * @returns {Object} {isValid, errors, warnings}
   */
  validateParsedData(players) {
    const errors = [];
    const warnings = [];

    if (!players || players.length === 0) {
      errors.push('No valid player data found');
      return { isValid: false, errors, warnings };
    }

    // Check for duplicate names
    const names = players.map(p => p.name.toLowerCase());
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      errors.push('Duplicate player names found');
    }

    // Check for empty names
    const emptyNames = players.filter(p => !p.name || p.name.trim().length === 0);
    if (emptyNames.length > 0) {
      errors.push('Some players have empty names');
    }

    // Check for invalid profit values
    const invalidProfits = players.filter(p => isNaN(p.profit));
    if (invalidProfits.length > 0) {
      errors.push('Some players have invalid profit/loss values');
    }

    // Check if all profits sum to zero (optional warning)
    const totalProfit = players.reduce((sum, p) => sum + p.profit, 0);
    if (Math.abs(totalProfit) > 0.01) { // Allow for small floating point errors
      warnings.push(`Total profit/loss is ${totalProfit.toFixed(2)} (should be 0 for balanced game)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate a preview of the game data
   * @param {Array} players - Array of parsed player data
   * @returns {Object} Preview data
   */
  generatePreview(players) {
    const convertedPlayers = players.map(player => {
      const { buyin, cashout } = this.convertProfitToBuyinCashout(player.profit);
      return {
        name: player.name,
        profit: player.profit,
        buyin,
        cashout
      };
    });

    const totalBuyins = convertedPlayers.reduce((sum, p) => sum + p.buyin, 0);
    const totalCashouts = convertedPlayers.reduce((sum, p) => sum + p.cashout, 0);
    const discrepancy = totalCashouts - totalBuyins;

    return {
      players: convertedPlayers,
      totalBuyins,
      totalCashouts,
      discrepancy,
      playerCount: players.length
    };
  }
}

module.exports = TextParser;
