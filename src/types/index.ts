export type ServiceType = 
  | 'translate'
  | 'questions'
  | 'convert'
  | 'voice'
  | 'image'
  | 'research'
  | 'solve';

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isVIP: boolean;
  vipExpiresAt?: string;
  hideAds: boolean;
  isBanned?: boolean;
  visitCount?: number;
  usageCount: number;
  dailyStreak: number;
  lastLoginDate: string;
  createdAt: string;
  streakRewardClaimed?: boolean;
}

export interface CommandAuditMeta {
  queryText?: string;
  inputPreview?: string;
  outputPreview?: string;
  attachedFileName?: string;
  attachedFileSize?: number;
  attachedFileType?: string;
  targetLang?: string;
  originalFileUrl?: string;
  originalFileStoragePath?: string;
  resultFileUrl?: string;
  resultFileStoragePath?: string;
  resultFileName?: string;
  resultFileType?: string;
  filesDeletedFromServer?: boolean;
  retentionDays?: number;
  expiresAt?: string;
  autoDeleted?: boolean;
  autoDeletedAt?: string;
}

export type AdminNotificationType = 'new_order' | 'banned_attempt' | 'auto_delete';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  orderId?: string;
  command?: string;
  timestamp: string;
  read: boolean;
}

export interface CommandLogEntry {
  id: string;
  userId: string;
  userName: string;
  command: string;
  details: string;
  status: 'success' | 'started' | 'blocked' | 'error';
  timestamp: string;
  audit?: CommandAuditMeta;
}


export interface FileRecord {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  serviceUsed: ServiceType;
  title: string;
  resultContent: string;
  metadata?: Record<string, any>;
  createdAt: string;
  retentionDays?: number;
  expiresAt?: string;
  autoDeleted?: boolean;
  autoDeletedAt?: string;
  orderId?: string;
  originalFileUrl?: string;
  resultFileUrl?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  recipientId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface AdminStats {
  totalUsers: number;
  dailyUsage: number;
  weeklyUsage: number;
  monthlyUsage: number;
  estimatedAdRevenue: number;
  vipSubscribers: number;
  topServices: { name: string; count: number; percentage: number }[];
}

export interface DynamicPageContent {
  id: string;
  key: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface AdStatus {
  hasUsedFreeOnce: boolean;
  adsWatchedThisSession: number;
  requiredAds: number;
  canProceed: boolean;
}

export type AnnouncementSeverity = 'info' | 'success' | 'warning' | 'urgent';

export interface GlobalAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  actionLabel?: string;
  actionUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  expiresAt?: string;
}

export type AdProviderId =
  | 'hilltopads'
  | 'admaven'
  | 'popads'
  | 'aads'
  | 'adsterra_direct'
  | 'custom';

export interface AdBannerUnit {
  enabled: boolean;
  mode: 'script_key' | 'aads_unit' | 'script_url';
  key: string;
  width: number;
  height: number;
  invokeUrl: string;
}

export interface AdPlatformStats {
  impressions: number;
  directLinkClicks: number;
  lastUpdatedAt?: string;
}

export interface AdPlatformConfig {
  provider: AdProviderId;
  enabled: boolean;
  directLinkUrl: string;
  inPageScriptUrl: string;
  popunderScriptUrl: string;
  nativeContainerId: string;
  nativeScriptUrl: string;
  bannerTop: AdBannerUnit;
  bannerBottom: AdBannerUnit;
  verificationMetaName: string;
  verificationMetaContent: string;
  verificationFileName: string;
  verificationFileContent: string;
  adsTxtContent: string;
  stats: AdPlatformStats;
  updatedAt: string;
}

