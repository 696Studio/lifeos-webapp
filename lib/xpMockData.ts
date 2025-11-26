// lib/xpMockData.ts

import { XpProfile } from '../types/xp';

export const xpMockProfile: XpProfile = {
  userId: 'mock-user-001',
  username: 'Ghost Grinder',

  avatarUrl: undefined,

  stats: {
    level: 3,
    totalXp: 420,
    currentXp: 120,
    nextLevelXp: 200,
    streakDays: 4,
    joinedAt: '2025-11-20T10:00:00.000Z',
  },

  tasks: [
    {
      id: 'invite-1',
      title: 'Invite 1 friend',
      description: 'Share your invite link and bring 1 friend.',
      xp: 100,
      category: 'invite',
      status: 'available',
      timesCompleted: 0,
      maxRepeats: 1,
    },
    {
      id: 'stream-1',
      title: 'Join the next stream',
      description: 'Watch the stream for 15 minutes.',
      xp: 50,
      category: 'stream',
      status: 'available',
      timesCompleted: 0,
    },
    {
      id: 'help-1',
      title: 'Help someone in chat',
      xp: 25,
      category: 'help',
      status: 'available',
      description: 'Answer a question in the community chat.',
      timesCompleted: 1,
      maxRepeats: 5,
    },
    {
      id: 'lessons-1',
      title: 'Watch 1 lesson',
      description: 'Complete any lesson.',
      xp: 40,
      category: 'lessons',
      status: 'available',
      timesCompleted: 0,
    },
    {
      id: 'ideas-1',
      title: 'Drop 3 ideas',
      description: 'Share 3 improvement ideas.',
      xp: 60,
      category: 'ideas',
      status: 'locked',
      timesCompleted: 0,
    },
  ],

  history: [
    {
      id: 'event-1',
      type: 'earn',
      amount: 150,
      createdAt: '2025-11-24T18:00:00.000Z',
      source: 'stream',
      taskId: 'stream-1',
    },
    {
      id: 'event-2',
      type: 'earn',
      amount: 200,
      createdAt: '2025-11-23T20:30:00.000Z',
      source: 'invite',
      taskId: 'invite-1',
    },
    {
      id: 'event-3',
      type: 'earn',
      amount: 70,
      createdAt: '2025-11-22T15:10:00.000Z',
      source: 'lessons',
      taskId: 'lessons-1',
    },
  ],

  trophies: [
    {
      id: 'trophy-1',
      title: 'First Blood',
      description: 'Earn your first 50 XP.',
      icon: 'trophy_first_blood',
      unlockedAt: '2025-11-22T15:10:00.000Z',
    },
    {
      id: 'trophy-2',
      title: 'Streak 3 days',
      description: 'Stay active 3 days in a row.',
      icon: 'trophy_streak_3',
      unlockedAt: '2025-11-24T18:00:00.000Z',
    },
    {
      id: 'trophy-3',
      title: 'Level 5 Demon',
      description: 'Reach level 5.',
      icon: 'trophy_level_5',
    },
  ],
};
