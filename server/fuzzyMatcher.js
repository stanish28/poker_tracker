/**
 * Fuzzy string matching utility for player names
 * Uses Levenshtein distance and other similarity algorithms
 */
class FuzzyMatcher {
  constructor() {
    this.minSimilarity = 0.7; // Minimum similarity score (0-1)
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Distance between strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Initialize matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[len2][len1];
  }

  /**
   * Calculate similarity score between two strings (0-1)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1, higher is more similar)
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const normalized1 = str1.toLowerCase().trim();
    const normalized2 = str2.toLowerCase().trim();
    
    if (normalized1 === normalized2) return 1;
    
    const maxLength = Math.max(normalized1.length, normalized2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(normalized1, normalized2);
    return 1 - (distance / maxLength);
  }

  /**
   * Find best match for a name in a list of existing names
   * @param {string} targetName - Name to match
   * @param {Array} existingNames - Array of {id, name} objects
   * @returns {Object|null} {id, name, similarity} or null if no good match
   */
  findBestMatch(targetName, existingNames) {
    if (!targetName || !existingNames || existingNames.length === 0) {
      return null;
    }

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const existing of existingNames) {
      const similarity = this.calculateSimilarity(targetName, existing.name);
      
      if (similarity > bestSimilarity && similarity >= this.minSimilarity) {
        bestMatch = {
          id: existing.id,
          name: existing.name,
          similarity: similarity
        };
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
  }

  /**
   * Match parsed players to existing players
   * @param {Array} parsedPlayers - Array of {name, profit} from parsing
   * @param {Array} existingPlayers - Array of {id, name} from database
   * @returns {Object} {matched, unmatched, suggestions}
   */
  matchPlayers(parsedPlayers, existingPlayers) {
    const matched = [];
    const unmatched = [];
    const suggestions = [];

    for (const parsedPlayer of parsedPlayers) {
      const match = this.findBestMatch(parsedPlayer.name, existingPlayers);
      
      if (match) {
        matched.push({
          parsedName: parsedPlayer.name,
          existingPlayer: {
            id: match.id,
            name: match.name
          },
          similarity: match.similarity,
          profit: parsedPlayer.profit
        });
      } else {
        // Look for partial matches for suggestions
        const partialMatches = existingPlayers
          .map(existing => ({
            id: existing.id,
            name: existing.name,
            similarity: this.calculateSimilarity(parsedPlayer.name, existing.name)
          }))
          .filter(match => match.similarity > 0.3) // Lower threshold for suggestions
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3); // Top 3 suggestions

        unmatched.push({
          parsedName: parsedPlayer.name,
          profit: parsedPlayer.profit,
          suggestions: partialMatches
        });
      }
    }

    return {
      matched,
      unmatched,
      suggestions
    };
  }

  /**
   * Set minimum similarity threshold
   * @param {number} threshold - Similarity threshold (0-1)
   */
  setMinSimilarity(threshold) {
    this.minSimilarity = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Get current minimum similarity threshold
   * @returns {number} Current threshold
   */
  getMinSimilarity() {
    return this.minSimilarity;
  }
}

module.exports = FuzzyMatcher;
