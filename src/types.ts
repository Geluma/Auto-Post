export interface ChannelItem {
  id: string;
  channelId: string;
  channelName?: string;
  message: string;
  hours: number;
  minutes: number;
  seconds: number;
  interval: number; // total in seconds
  randomDelay?: number;
  enabled?: boolean;
  lastPostedAt?: string;
  nextPostAt?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  globalName?: string;
  avatar?: string;
  avatarUrl?: string;
}

export interface AccountData {
  id: string;
  name: string;
  token: string;
  useWebhook: boolean;
  webhookUrl: string;
  channels: ChannelItem[];
  isRunning: boolean;
  userProfile?: UserProfile;
  stats: {
    sentCount: number;
    failedCount: number;
    lastPostedAt?: string;
    lastStatusMessage?: string;
    lastSuccess?: boolean;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  accountId: string;
  accountName: string;
  channelId: string;
  success: boolean;
  message: string;
  statusText: string;
}
