/**
 * Famous People Comparison — Celebrity Chart Matching
 * 
 * Calculates similarity percentage between user chart and celebrity charts
 * Based on: Type, Profile, Gates, Centers, Authority, Definition
 * 
 * Scoring Algorithm:
 * - Type match: 30 points
 * - Profile match: 20 points (10 for conscious line, 10 for unconscious line)
 * - Authority match: 15 points
 * - Definition match: 10 points
 * - Gate overlap: 20 points (1 point per matching gate, max 20)
 * - Center overlap: 5 points (0.5 per matching defined center, max 5)
 * Total: 100 points maximum
 */

import { calculateFullChart } from '../../../src/engine/index.js';
import { parseToUTC } from '../utils/parseToUTC.js';
import celebsData from '../data/celebrities.json' with { type: 'json' };

// ─── Similarity Scoring ──────────────────────────────────────────────────

/**
 * Calculate similarity percentage between user chart and celebrity chart
 * @param {Object} userChart - User's full chart
 * @param {Object} celebChart - Celebrity's full chart
 * @returns {Object} { totalScore, breakdown }
 */
export function calculateSimilarity(userChart, celebChart) {
  let totalScore = 0;
  const breakdown = {};
  
  const user = userChart.chart;
  const celeb = celebChart.chart;
  
  // 1. Type Match (30 points)
  if (user.type === celeb.type) {
    breakdown.type = { score: 30, match: true, detail: user.type };
    totalScore += 30;
  } else {
    breakdown.type = { score: 0, match: false, detail: `You: ${user.type}, Them: ${celeb.type}` };
  }
  
  // 2. Profile Match (20 points total: 10 conscious, 10 unconscious)
  const [userConscious, userUnconscious] = user.profile.split('/').map(Number);
  const [celebConscious, celebUnconscious] = celeb.profile.split('/').map(Number);
  
  let profileScore = 0;
  if (userConscious === celebConscious) {
    profileScore += 10;
  }
  if (userUnconscious === celebUnconscious) {
    profileScore += 10;
  }
  
  breakdown.profile = {
    score: profileScore,
    match: profileScore === 20,
    detail: profileScore === 20 ? `Both ${user.profile}` : `You: ${user.profile}, Them: ${celeb.profile}`
  };
  totalScore += profileScore;
  
  // 3. Authority Match (15 points)
  if (user.authority === celeb.authority) {
    breakdown.authority = { score: 15, match: true, detail: user.authority };
    totalScore += 15;
  } else {
    breakdown.authority = { score: 0, match: false, detail: `You: ${user.authority}, Them: ${celeb.authority}` };
  }
  
  // 4. Definition Match (10 points)
  if (user.definition === celeb.definition) {
    breakdown.definition = { score: 10, match: true, detail: user.definition };
    totalScore += 10;
  } else {
    breakdown.definition = { score: 0, match: false, detail: `You: ${user.definition}, Them: ${celeb.definition}` };
  }
  
  // 5. Gate Overlap (20 points max - 1 point per matching gate)
  const userGates = new Set([
    ...Object.values(user.personalityGates || {}),
    ...Object.values(user.designGates || {})
  ]);
  const celebGates = new Set([
    ...Object.values(celeb.personalityGates || {}),
    ...Object.values(celeb.designGates || {})
  ]);
  
  const matchingGates = [...userGates].filter(gate => celebGates.has(gate));
  const gateScore = Math.min(matchingGates.length, 20);
  
  breakdown.gates = {
    score: gateScore,
    matchCount: matchingGates.length,
    detail: `${matchingGates.length} gates in common`,
    gates: matchingGates
  };
  totalScore += gateScore;
  
  // 6. Center Overlap (5 points max - 0.5 per matching defined center)
  const userCenters = new Set(user.definedCenters || []);
  const celebCenters = new Set(celeb.definedCenters || []);
  
  const matchingCenters = [...userCenters].filter(center => celebCenters.has(center));
  const centerScore = Math.min(matchingCenters.length * 0.5, 5);
  
  breakdown.centers = {
    score: centerScore,
    matchCount: matchingCenters.length,
    detail: `${matchingCenters.length} defined centers in common`,
    centers: matchingCenters
  };
  totalScore += centerScore;
  
  return {
    totalScore: Math.round(totalScore),
    percentage: Math.round(totalScore),
    breakdown
  };
}

/**
 * Find top celebrity matches for a user chart
 * @param {Object} userChart - User's chart
 * @param {number} limit - Number of matches to return
 * @returns {Array} Top celebrity matches sorted by similarity
 */
export async function findCelebrityMatches(userChart, limit = 10) {
  const matches = [];
  
  for (const celeb of celebsData.celebrities) {
    // Skip if missing required birth info
    if (!celeb.birthDate || !celeb.birthTime || !celeb.lat || !celeb.lng) {
      // Use noon chart for unknown birth time
      if (!celeb.birthTime) {
        celeb.birthTime = "12:00";
      }
    }
    
    try {
      // Calculate celebrity chart
      const utc = parseToUTC(
        celeb.birthDate,
        celeb.birthTime,
        celeb.birthTimezone || 'UTC'
      );
      
      const celebChart = calculateFullChart({
        ...utc,
        lat: celeb.lat,
        lng: celeb.lng,
        includeTransits: false
      });
      
      // Calculate similarity
      const similarity = calculateSimilarity(userChart, celebChart);
      
      matches.push({
        celebrity: {
          id: celeb.id,
          name: celeb.name,
          category: celeb.category,
          bio: celeb.bio,
          achievements: celeb.achievements,
          tags: celeb.tags,
          location: celeb.location
        },
        chart: {
          type: celebChart.chart.type,
          profile: celebChart.chart.profile,
          authority: celebChart.chart.authority,
          definition: celebChart.chart.definition,
          definedCenters: celebChart.chart.definedCenters
        },
        similarity: {
          percentage: similarity.percentage,
          score: similarity.totalScore,
          breakdown: similarity.breakdown
        }
      });
      
    } catch (error) {
      console.error(`Failed to calculate chart for ${celeb.name}:`, error.message);
      // Skip this celebrity if chart calculation fails
      continue;
    }
  }
  
  // Sort by similarity percentage (descending)
  matches.sort((a, b) => b.similarity.percentage - a.similarity.percentage);
  
  // Return top N matches
  return matches.slice(0, limit);
}

/**
 * Get specific celebrity match details
 * @param {Object} userChart - User's chart
 * @param {string} celebrityId - Celebrity ID from database
 * @returns {Object|null} Detailed match info or null if not found
 */
export async function getCelebrityMatch(userChart, celebrityId) {
  const celeb = celebsData.celebrities.find(c => c.id === celebrityId);
  
  if (!celeb) {
    return null;
  }
  
  // Use noon chart if birth time unknown
  if (!celeb.birthTime) {
    celeb.birthTime = "12:00";
  }
  
  try {
    const utc = parseToUTC(
      celeb.birthDate,
      celeb.birthTime,
      celeb.birthTimezone || 'UTC'
    );
    
    const celebChart = calculateFullChart({
      ...utc,
      lat: celeb.lat,
      lng: celeb.lng,
      includeTransits: false
    });
    
    const similarity = calculateSimilarity(userChart, celebChart);
    
    return {
      celebrity: {
        id: celeb.id,
        name: celeb.name,
        category: celeb.category,
        bio: celeb.bio,
        achievements: celeb.achievements,
        tags: celeb.tags,
        birthDate: celeb.birthDate,
        location: celeb.location
      },
      chart: {
        type: celebChart.chart.type,
        profile: celebChart.chart.profile,
        authority: celebChart.chart.authority,
        definition: celebChart.chart.definition,
        definedCenters: celebChart.chart.definedCenters,
        personalityGates: celebChart.chart.personalityGates,
        designGates: celebChart.chart.designGates
      },
      similarity: {
        percentage: similarity.percentage,
        score: similarity.totalScore,
        breakdown: similarity.breakdown
      },
      insights: generateMatchInsights(similarity, celeb)
    };
    
  } catch (error) {
    console.error(`Failed to calculate chart for ${celeb.name}:`, error.message);
    return null;
  }
}

/**
 * Generate human-readable insights about the match
 */
function generateMatchInsights(similarity, celeb) {
  const insights = [];
  const { breakdown } = similarity;
  
  // Type match insight
  if (breakdown.type.match) {
    insights.push({
      area: 'Type',
      message: `You share the same type as ${celeb.name}: ${breakdown.type.detail}. ` +
        `This means you both have a similar energetic blueprint and strategy for engaging with life.`,
      score: breakdown.type.score
    });
  }
  
  // Profile match insight
  if (breakdown.profile.match) {
    insights.push({
      area: 'Profile',
      message: `You have the same profile as ${celeb.name}: ${breakdown.profile.detail}. ` +
        `This suggests similar life themes, learning patterns, and ways of interacting with others.`,
      score: breakdown.profile.score
    });
  } else if (breakdown.profile.score >= 10) {
    insights.push({
      area: 'Profile',
      message: `You share one line with ${celeb.name}'s profile. ` +
        `There's some overlap in how you approach personal growth or relationships.`,
      score: breakdown.profile.score
    });
  }
  
  // Authority match insight
  if (breakdown.authority.match) {
    insights.push({
      area: 'Authority',
      message: `You and ${celeb.name} both use ${breakdown.authority.detail} as your decision-making authority. ` +
        `You process major life choices through the same inner compass.`,
      score: breakdown.authority.score
    });
  }
  
  // Gate overlap insight
  if (breakdown.gates.matchCount >= 10) {
    insights.push({
      area: 'Gates',
      message: `You share ${breakdown.gates.matchCount} gates with ${celeb.name}, including ${breakdown.gates.gates.slice(0, 3).join(', ')}. ` +
        `These common activations suggest similar talents, challenges, and life themes.`,
      score: breakdown.gates.score
    });
  } else if (breakdown.gates.matchCount >= 5) {
    insights.push({
      area: 'Gates',
      message: `You have ${breakdown.gates.matchCount} gates in common with ${celeb.name}. ` +
        `These shared activations hint at overlapping gifts and experiences.`,
      score: breakdown.gates.score
    });
  }
  
  // Definition match insight
  if (breakdown.definition.match) {
    insights.push({
      area: 'Definition',
      message: `Both you and ${celeb.name} have ${breakdown.definition.detail} definition. ` +
        `This affects how you process information and interact with your environment.`,
      score: breakdown.definition.score
    });
  }
  
  return insights;
}

/**
 * Get all celebrities in a category
 */
export function getCelebritiesByCategory(category) {
  return celebsData.celebrities.filter(c => c.category === category);
}

/**
 * Search celebrities by name or tag
 */
export function searchCelebrities(query) {
  const lowerQuery = query.toLowerCase();
  return celebsData.celebrities.filter(c => 
    c.name.toLowerCase().includes(lowerQuery) ||
    c.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    c.bio.toLowerCase().includes(lowerQuery)
  );
}
