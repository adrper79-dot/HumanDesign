/**
 * Achievements Library — Gamification & Milestone Tracking
 * 
 * Defines achievement criteria, tracks progress, awards badges
 * Integrates with user actions across the platform
 */

// ─── Achievement Definitions ─────────────────────────────────

export const ACHIEVEMENTS = {
  // ─── Getting Started ─────────────────────────────────────
  
  FIRST_CHART: {
    id: 'first_chart',
    name: 'Self-Discovery Begins',
    description: 'Generated your first Energy Blueprint chart',
    category: 'getting_started',
    icon: '🌟',
    tier: 'bronze',
    points: 10,
    criteria: {
      type: 'event_count',
      event: 'chart_calculated',
      threshold: 1
    },
    unlockMessage: '🌟 Achievement unlocked: Self-Discovery Begins!'
  },
  
  PROFILE_GENERATED: {
    id: 'profile_generated',
    name: 'AI Synthesis',
    description: 'Generated your first Prime Self Profile',
    category: 'getting_started',
    icon: '✨',
    tier: 'bronze',
    points: 25,
    criteria: {
      type: 'event_count',
      event: 'profile_generated',
      threshold: 1
    },
    unlockMessage: '✨ Achievement unlocked: AI Synthesis! Your personalized insights are ready.'
  },
  
  FIRST_TRANSIT: {
    id: 'first_transit',
    name: 'Cosmic Weather',
    description: 'Checked your first transit snapshot',
    category: 'getting_started',
    icon: '🌙',
    tier: 'bronze',
    points: 15,
    criteria: {
      type: 'event_count',
      event: 'transit_checked',
      threshold: 1
    },
    unlockMessage: '🌙 Achievement unlocked: Cosmic Weather! You\'re tuned into the energies.'
  },
  
  // ─── Engagement ──────────────────────────────────────────
  
  WEEK_STREAK: {
    id: 'week_streak',
    name: 'Dedicated Explorer',
    description: 'Logged in 7 days in a row',
    category: 'engagement',
    icon: '🔥',
    tier: 'silver',
    points: 50,
    criteria: {
      type: 'streak',
      event: 'daily_login',
      threshold: 7
    },
    unlockMessage: '🔥 Achievement unlocked: Dedicated Explorer! 7-day streak!'
  },
  
  MONTH_STREAK: {
    id: 'month_streak',
    name: 'True devotee',
    description: 'Logged in 30 days in a row',
    category: 'engagement',
    icon: '💎',
    tier: 'gold',
    points: 200,
    criteria: {
      type: 'streak',
      event: 'daily_login',
      threshold: 30
    },
    unlockMessage: '💎 Achievement unlocked: True Devotee! 30-day streak! Incredible dedication.'
  },
  
  DAILY_CHECKER: {
    id: 'daily_checker',
    name: 'Daily Ritual',
    description: 'Checked transits 30 days in a row',
    category: 'engagement',
    icon: '📅',
    tier: 'silver',
    points: 75,
    criteria: {
      type: 'streak',
      event: 'transit_checked',
      threshold: 30
    },
    unlockMessage: '📅 Achievement unlocked: Daily Ritual! You never miss the cosmic weather.'
  },
  
  // ─── Exploration ─────────────────────────────────────────
  
  TRANSIT_EXPLORER: {
    id: 'transit_explorer',
    name: 'Transit Explorer',
    description: 'Calculated 10 transit snapshots',
    category: 'exploration',
    icon: '🔭',
    tier: 'silver',
    points: 40,
    criteria: {
      type: 'event_count',
      event: 'transit_checked',
      threshold: 10
    },
    unlockMessage: '🔭 Achievement unlocked: Transit Explorer! You\'re tracking the energies.'
  },
  
  TIMING_MASTER: {
    id: 'timing_master',
    name: 'Perfect Timing',
    description: 'Used the Best Timing engine 5 times',
    category: 'exploration',
    icon: '⏰',
    tier: 'silver',
    points: 60,
    criteria: {
      type: 'event_count',
      event: 'timing_calculated',
      threshold: 5
    },
    unlockMessage: '⏰ Achievement unlocked: Perfect Timing! You\'re aligning with the cosmos.'
  },
  
  CYCLE_TRACKER: {
    id: 'cycle_tracker',
    name: 'Cycle Tracker',
    description: 'Checked all major life cycles (Saturn, Jupiter, Uranus)',
    category: 'exploration',
    icon: '♄',
    tier: 'gold',
    points: 100,
    criteria: {
      type: 'composite',
      events: ['cycles_checked:saturn', 'cycles_checked:jupiter', 'cycles_checked:uranus'],
      threshold: 3
    },
    unlockMessage: '♄ Achievement unlocked: Cycle Tracker! You understand the long arc.'
  },
  
  // ─── Social ──────────────────────────────────────────────
  
  COMPOSITE_CREATOR: {
    id: 'composite_creator',
    name: 'Relationship Explorer',
    description: 'Created your first composite chart',
    category: 'social',
    icon: '❤️',
    tier: 'bronze',
    points: 35,
    criteria: {
      type: 'event_count',
      event: 'composite_created',
      threshold: 1
    },
    unlockMessage: '❤️ Achievement unlocked: Relationship Explorer!'
  },
  
  CLUSTER_MEMBER: {
    id: 'cluster_member',
    name: 'Community Builder',
    description: 'Joined your first cluster',
    category: 'social',
    icon: '👥',
    tier: 'silver',
    points: 50,
    criteria: {
      type: 'event_count',
      event: 'cluster_joined',
      threshold: 1
    },
    unlockMessage: '👥 Achievement unlocked: Community Builder!'
  },
  
  REFERRAL_STARTER: {
    id: 'referral_starter',
    name: 'Viral Spreader',
    description: 'Referred your first friend',
    category: 'social',
    icon: '🚀',
    tier: 'silver',
    points: 75,
    criteria: {
      type: 'event_count',
      event: 'referral_signup',
      threshold: 1
    },
    unlockMessage: '🚀 Achievement unlocked: Viral Spreader! Share the knowledge.'
  },
  
  REFERRAL_CHAMPION: {
    id: 'referral_champion',
    name: 'Referral Champion',
    description: 'Referred 10 friends who signed up',
    category: 'social',
    icon: '🏆',
    tier: 'gold',
    points: 300,
    criteria: {
      type: 'event_count',
      event: 'referral_signup',
      threshold: 10
    },
    unlockMessage: '🏆 Achievement unlocked: Referral Champion! You\'re building the tribe.'
  },
  
  // ─── Mastery ─────────────────────────────────────────────
  
  CHART_COLLECTOR: {
    id: 'chart_collector',
    name: 'Chart Collector',
    description: 'Calculated 25 charts (friends, family, clients)',
    category: 'mastery',
    icon: '📊',
    tier: 'silver',
    points: 80,
    criteria: {
      type: 'event_count',
      event: 'chart_calculated',
      threshold: 25
    },
    unlockMessage: '📊 Achievement unlocked: Chart Collector!'
  },
  
  PROFILE_MASTER: {
    id: 'profile_master',
    name: 'Profile Master',
    description: 'Generated 10 Prime Self Profiles',
    category: 'mastery',
    icon: '🎓',
    tier: 'gold',
    points: 150,
    criteria: {
      type: 'event_count',
      event: 'profile_generated',
      threshold: 10
    },
    unlockMessage: '🎓 Achievement unlocked: Profile Master! You\'re diving deep.'
  },
  
  // ─── Premium ─────────────────────────────────────────────
  
  UPGRADED_SEEKER: {
    id: 'upgraded_seeker',
    name: 'Committed Explorer',
    description: 'Upgraded to Explorer tier',
    category: 'premium',
    icon: '⭐',
    tier: 'gold',
    points: 100,
    criteria: {
      type: 'tier_upgrade',
      tier: 'regular'
    },
    unlockMessage: '⭐ Achievement unlocked: Committed Explorer! Welcome to unlimited exploration.'
  },
  
  UPGRADED_GUIDE: {
    id: 'upgraded_guide',
    name: 'Professional Guide',
    description: 'Upgraded to Guide tier',
    category: 'premium',
    icon: '🌟',
    tier: 'platinum',
    points: 250,
    criteria: {
      type: 'tier_upgrade',
      tier: 'practitioner'
    },
    unlockMessage: '🌟 Achievement unlocked: Professional Guide! You\'re empowering others.'
  },
  
  UPGRADED_PRACTITIONER: {
    id: 'upgraded_practitioner',
    name: 'Master Practitioner',
    description: 'Upgraded to Studio tier',
    category: 'premium',
    icon: '👑',
    tier: 'platinum',
    points: 500,
    criteria: {
      type: 'tier_upgrade',
      tier: 'white_label'
    },
    unlockMessage: '👑 Achievement unlocked: Master Practitioner! You are the guide.'
  },
  
  // ─── Power User ──────────────────────────────────────────
  
  ALERT_SETTER: {
    id: 'alert_setter',
    name: 'Alert Setter',
    description: 'Created your first transit alert',
    category: 'power_user',
    icon: '🔔',
    tier: 'bronze',
    points: 30,
    criteria: {
      type: 'event_count',
      event: 'alert_created',
      threshold: 1
    },
    unlockMessage: '🔔 Achievement unlocked: Alert Setter! Never miss an important transit.'
  },
  
  API_DEVELOPER: {
    id: 'api_developer',
    name: 'API Developer',
    description: 'Generated your first API key',
    category: 'power_user',
    icon: '🔑',
    tier: 'gold',
    points: 120,
    criteria: {
      type: 'event_count',
      event: 'api_key_created',
      threshold: 1
    },
    unlockMessage: '🔑 Achievement unlocked: API Developer! Build on Prime Self.'
  },
  
  WEBHOOK_INTEGRATOR: {
    id: 'webhook_integrator',
    name: 'Webhook Integrator',
    description: 'Created your first webhook integration',
    category: 'power_user',
    icon: '🔗',
    tier: 'gold',
    points: 100,
    criteria: {
      type: 'event_count',
      event: 'webhook_created',
      threshold: 1
    },
    unlockMessage: '🔗 Achievement unlocked: Webhook Integrator!'
  },
  
  // ─── Milestones ──────────────────────────────────────────
  
  POINTS_100: {
    id: 'points_100',
    name: 'Apprentice',
    description: 'Earned 100 achievement points',
    category: 'milestone',
    icon: '🥉',
    tier: 'bronze',
    points: 0,  // Bonus points not awarded for point milestones
    criteria: {
      type: 'points_total',
      threshold: 100
    },
    unlockMessage: '🥉 Milestone reached: Apprentice! 100 points earned.'
  },
  
  POINTS_500: {
    id: 'points_500',
    name: 'Journeyman',
    description: 'Earned 500 achievement points',
    category: 'milestone',
    icon: '🥈',
    tier: 'silver',
    points: 0,
    criteria: {
      type: 'points_total',
      threshold: 500
    },
    unlockMessage: '🥈 Milestone reached: Journeyman! 500 points earned.'
  },
  
  POINTS_1000: {
    id: 'points_1000',
    name: 'Expert',
    description: 'Earned 1,000 achievement points',
    category: 'milestone',
    icon: '🥇',
    tier: 'gold',
    points: 0,
    criteria: {
      type: 'points_total',
      threshold: 1000
    },
    unlockMessage: '🥇 Milestone reached: Expert! 1,000 points earned.'
  },
  
  POINTS_2500: {
    id: 'points_2500',
    name: 'Master',
    description: 'Earned 2,500 achievement points',
    category: 'milestone',
    icon: '💫',
    tier: 'platinum',
    points: 0,
    criteria: {
      type: 'points_total',
      threshold: 2500
    },
    unlockMessage: '💫 Milestone reached: Master! 2,500 points earned. You are legendary.'
  }
};

// Achievement categories with display order
export const CATEGORIES = {
  getting_started: { name: 'Getting Started', order: 1, icon: '🎯' },
  engagement: { name: 'Engagement', order: 2, icon: '🔥' },
  exploration: { name: 'Exploration', order: 3, icon: '🔭' },
  social: { name: 'Social', order: 4, icon: '👥' },
  mastery: { name: 'Mastery', order: 5, icon: '🎓' },
  premium: { name: 'Premium', order: 6, icon: '⭐' },
  power_user: { name: 'Power User', order: 7, icon: '⚡' },
  milestone: { name: 'Milestones', order: 8, icon: '🏅' }
};

// Tier display (for badge colors, etc.)
export const TIERS = {
  bronze: { name: 'Bronze', color: '#CD7F32', order: 1 },
  silver: { name: 'Silver', color: '#C0C0C0', order: 2 },
  gold: { name: 'Gold', color: '#FFD700', order: 3 },
  platinum: { name: 'Platinum', color: '#E5E4E2', order: 4 }
};

// ─── Achievement Progress Tracking ───────────────────────────

/**
 * Calculate individual achievement progress for a user
 * @param {Object} achievement - Achievement definition (from ACHIEVEMENTS)
 * @param {Object} userProgress - { events, streaks, tier, totalPoints }
 * @param {boolean} isUnlocked - Whether the achievement is already unlocked
 * @returns {Object} { current, target, percentage }
 */
export function calculateIndividualProgress(achievement, userProgress, isUnlocked) {
  if (isUnlocked) {
    const target = achievement.criteria.threshold || 1;
    return { current: target, target, percentage: 100 };
  }

  const { type, event, threshold, events, tier } = achievement.criteria;

  switch (type) {
    case 'event_count': {
      const current = userProgress.events[event] || 0;
      return {
        current,
        target: threshold,
        percentage: Math.min(100, Math.round((current / threshold) * 100))
      };
    }

    case 'streak': {
      const current = userProgress.streaks[event] || 0;
      return {
        current,
        target: threshold,
        percentage: Math.min(100, Math.round((current / threshold) * 100))
      };
    }

    case 'composite': {
      // Count how many sub-events the user has completed (each needs count >= 1)
      const completed = events.filter(ev => (userProgress.events[ev] || 0) >= 1).length;
      const target = events.length;
      return {
        current: completed,
        target,
        percentage: Math.min(100, Math.round((completed / target) * 100))
      };
    }

    case 'tier_upgrade': {
      const currentRank = getTierRank(userProgress.tier);
      const targetRank = getTierRank(tier);
      return {
        current: currentRank,
        target: targetRank,
        percentage: targetRank > 0
          ? Math.min(100, Math.round((currentRank / targetRank) * 100))
          : 0
      };
    }

    case 'points_total': {
      const current = userProgress.totalPoints || 0;
      return {
        current,
        target: threshold,
        percentage: Math.min(100, Math.round((current / threshold) * 100))
      };
    }

    default:
      return { current: 0, target: 1, percentage: 0 };
  }
}

/**
 * Check if achievement criteria is met
 * @param {Object} achievement - Achievement definition
 * @param {Object} userProgress - User's progress data
 * @returns {boolean} Whether achievement is unlocked
 */
export function checkAchievementCriteria(achievement, userProgress) {
  const { type, event, threshold, events, tier } = achievement.criteria;
  
  switch (type) {
    case 'event_count':
      return (userProgress.events[event] || 0) >= threshold;
      
    case 'streak':
      return (userProgress.streaks[event] || 0) >= threshold;
      
    case 'composite':
      // All events must meet threshold
      return events.every(ev => (userProgress.events[ev] || 0) >= threshold);
      
    case 'tier_upgrade':
      return userProgress.tier === tier || getTierRank(userProgress.tier) > getTierRank(tier);
      
    case 'points_total':
      return userProgress.totalPoints >= threshold;
      
    default:
      return false;
  }
}

/**
 * Get tier rank for comparison (higher number = higher tier)
 */
function getTierRank(tier) {
  const ranks = { free: 0, regular: 1, practitioner: 2, white_label: 3, seeker: 1, guide: 2 };
  return ranks[tier] || 0;
}

/**
 * Get achievements that are newly unlocked
 * @param {Object} unlockedAchievements - Already unlocked (Set of achievement IDs)
 * @param {Object} userProgress - User's current progress
 * @returns {Array} Newly unlocked achievements
 */
export function getNewlyUnlockedAchievements(unlockedAchievements, userProgress) {
  const newlyUnlocked = [];
  
  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    // Skip if already unlocked
    if (unlockedAchievements.has(id)) continue;
    
    // Check if criteria is now met
    if (checkAchievementCriteria(achievement, userProgress)) {
      newlyUnlocked.push({ ...achievement, id });
    }
  }
  
  return newlyUnlocked;
}

/**
 * Calculate total points from achievements
 * @param {Set} unlockedAchievements - Set of unlocked achievement IDs
 * @returns {number} Total points
 */
export function calculateTotalPoints(unlockedAchievements) {
  let total = 0;
  for (const id of unlockedAchievements) {
    const achievement = ACHIEVEMENTS[id];
    if (achievement) {
      total += achievement.points;
    }
  }
  return total;
}

/**
 * Get achievement progress percentage
 * @param {Set} unlockedAchievements - Unlocked achievement IDs
 * @returns {Object} Progress stats
 */
export function getAchievementProgress(unlockedAchievements) {
  const totalAchievements = Object.keys(ACHIEVEMENTS).length;
  const unlockedCount = unlockedAchievements.size;
  const percentage = Math.round((unlockedCount / totalAchievements) * 100);
  const totalPoints = calculateTotalPoints(unlockedAchievements);
  
  const categoryProgress = {};
  for (const [categoryId, category] of Object.entries(CATEGORIES)) {
    const categoryAchievements = Object.values(ACHIEVEMENTS).filter(
      a => a.category === categoryId
    );
    const unlockedInCategory = categoryAchievements.filter (
      a => unlockedAchievements.has(a.id)
    ).length;
    
    categoryProgress[categoryId] = {
      total: categoryAchievements.length,
      unlocked: unlockedInCategory,
      percentage: Math.round((unlockedInCategory / categoryAchievements.length) * 100)
    };
  }
  
  return {
    totalAchievements,
    unlockedCount,
    percentage,
    totalPoints,
    categoryProgress
  };
}
