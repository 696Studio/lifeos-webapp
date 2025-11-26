// types/xp.ts

export type XpTaskCategory = 'invite' | 'stream' | 'help' | 'lessons' | 'ideas';

export type XpTaskStatus = 'available' | 'pending' | 'completed' | 'locked';

export interface XpTask {
  id: string;
  title: string;
  description?: string;
  xp: number;
  category: XpTaskCategory;
  status: XpTaskStatus;
  timesCompleted: number;
  maxRepeats?: number;
}

export interface XpStats {
  level: number;
  totalXp: number;
  currentXp: number;
  nextLevelXp: number;
  streakDays: number;
  joinedAt: string;
}

export type XpEventType = 'earn' | 'spend';

export interface XpEvent {
  id: string;
  type: XpEventType;
  amount: number;
  createdAt: string;
  source?: string;
  taskId?: string;
}

export interface XpTrophy {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface XpProfile {
  userId: string;
  username: string;
  avatarUrl?: string;
  stats: XpStats;
  tasks: XpTask[];
  history: XpEvent[];
  trophies: XpTrophy[];
}
