import { CommandLogEntry, User } from '../types';

export const LOCAL_USER_STORAGE_KEY = 'metany_local_user';
export const LOCAL_USERS_REGISTRY_KEY = 'metany_local_users';
export const LOCAL_COMMAND_LOGS_KEY = 'metany_command_logs';
export const CONTACT_MESSAGES_STORAGE_KEY = 'metany_contact_messages';

// Precomputed SHA-256 digests of authorized admin emails (no plaintext emails in codebase)
const ADMIN_EMAIL_SHA256_SET = new Set<string>([
  'f1534bfd1837931856adcc0eb0661a03122820025ecfcd7a53730f7632bad5fa',
  'ca51296b4710ba6c18a68f5cca8ed0ca0d00c617b06abca33c91a19cc2cebbc1',
  '2c540c73b506f0980dd7d34ed104ed7e6c367713a270484d9e9933f8ff9ca9bf',
  'e467b597793d82c60ccf8103ea5086268ac935cdbb8024426991c981d00dd49f',
]);

/**
 * Pure TypeScript synchronous SHA-256 fallback so email hash verification works
 * everywhere (even in non-secure http:// contexts where crypto.subtle may be omitted).
 */
function sha256Sync(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let input = ascii + '\x80';
  while ((input.length % 64) - 56) input += '\x00';
  for (let i = 0; i < input.length; i++) {
    const j = input.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Normalize an input string to UTF-8 binary representation and check against authorized admin SHA-256 digests
 */
export async function isAuthorizedAdminEmail(rawEmail: string): Promise<boolean> {
  const normalized = (rawEmail || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(normalized);
      const buf = await crypto.subtle.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return ADMIN_EMAIL_SHA256_SET.has(hex);
    }
  } catch {
    // Fallback to sync SHA-256
  }

  return ADMIN_EMAIL_SHA256_SET.has(sha256Sync(normalized));
}

export function isAuthorizedAdminEmailSync(rawEmail: string): boolean {
  const normalized = (rawEmail || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;
  return ADMIN_EMAIL_SHA256_SET.has(sha256Sync(normalized));
}

export function getRegisteredUsers(): User[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function syncUserToRegistry(user: User): User {
  try {
    const list = getRegisteredUsers();
    const idx = list.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      // Preserve admin-applied flags such as isBanned, hideAds, isVIP if updated by admin
      const existing = list[idx];
      const merged: User = {
        ...user,
        isBanned: existing.isBanned ?? user.isBanned ?? false,
        hideAds: existing.hideAds ?? user.hideAds,
        isVIP: existing.isVIP || user.isVIP,
        visitCount: Math.max(existing.visitCount || 0, user.visitCount || 1),
        usageCount: Math.max(existing.usageCount || 0, user.usageCount || 0),
      };
      list[idx] = merged;
      localStorage.setItem(LOCAL_USERS_REGISTRY_KEY, JSON.stringify(list));
      return merged;
    } else {
      const next = [
        ...list,
        {
          ...user,
          visitCount: user.visitCount || 1,
          isBanned: Boolean(user.isBanned),
        },
      ];
      localStorage.setItem(LOCAL_USERS_REGISTRY_KEY, JSON.stringify(next));
      return user;
    }
  } catch {
    return user;
  }
}

export function saveAllRegisteredUsers(users: User[]): void {
  try {
    localStorage.setItem(LOCAL_USERS_REGISTRY_KEY, JSON.stringify(users));
    // Also sync active local user if matching
    const rawCurrent = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
    if (rawCurrent) {
      const curr: User = JSON.parse(rawCurrent);
      const match = users.find((u) => u.id === curr.id);
      if (match) {
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(match));
      }
    }
  } catch {
    // ignore storage errors
  }
}

export const COMMANDS_UPDATED_EVENT = 'metany:commands-updated';
export const ADMIN_NOTIFICATIONS_STORAGE_KEY = 'metany_admin_notifications';
export const ADMIN_NOTIFICATIONS_EVENT = 'metany:admin-notifications-updated';

export interface ClientAdminNotificationInput {
  id?: string;
  type: 'new_order' | 'banned_attempt' | 'auto_delete';
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  orderId?: string;
  command?: string;
  timestamp?: string;
}

export interface StoredAdminNotification {
  id: string;
  type: 'new_order' | 'banned_attempt' | 'auto_delete';
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  orderId?: string;
  command?: string;
  timestamp: string;
  read: boolean;
}

export function getAdminNotificationsLocal(): StoredAdminNotification[] {
  try {
    const raw = localStorage.getItem(ADMIN_NOTIFICATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushAdminNotification(input: ClientAdminNotificationInput): StoredAdminNotification | null {
  try {
    const list = getAdminNotificationsLocal();
    const id = input.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (list.some((n) => n.id === id)) return null;

    const item: StoredAdminNotification = {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      userId: input.userId,
      userName: input.userName,
      orderId: input.orderId,
      command: input.command,
      timestamp: input.timestamp || new Date().toISOString(),
      read: false,
    };

    const next = [item, ...list].slice(0, 150);
    localStorage.setItem(ADMIN_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATIONS_EVENT, { detail: item }));
    }

    if (typeof fetch !== 'undefined') {
      fetch('/api/admin-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }).catch(() => {});
    }
    return item;
  } catch {
    return null;
  }
}

export async function fetchAdminNotificationsMerged(): Promise<StoredAdminNotification[]> {
  const map = new Map<string, StoredAdminNotification>();
  for (const n of getAdminNotificationsLocal()) {
    if (n?.id) map.set(n.id, n);
  }
  try {
    const resp = await fetch('/api/admin-notifications');
    if (resp.ok) {
      const data = await resp.json();
      if (data?.success && Array.isArray(data.notifications)) {
        for (const n of data.notifications) {
          if (n?.id) {
            const prev = map.get(n.id);
            map.set(n.id, prev ? { ...n, read: prev.read || n.read } : n);
          }
        }
      }
    }
  } catch {
    // ignore offline
  }
  const merged = Array.from(map.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 150);
  try {
    localStorage.setItem(ADMIN_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
  return merged;
}

export async function markAllAdminNotificationsRead(): Promise<void> {
  try {
    const next = getAdminNotificationsLocal().map((n) => ({ ...n, read: true }));
    localStorage.setItem(ADMIN_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(next));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATIONS_EVENT));
    }
    await fetch('/api/admin-notifications/read-all', { method: 'PATCH' }).catch(() => {});
  } catch {
    // ignore
  }
}

export async function clearAdminNotifications(): Promise<void> {
  try {
    localStorage.setItem(ADMIN_NOTIFICATIONS_STORAGE_KEY, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ADMIN_NOTIFICATIONS_EVENT));
    }
    await fetch('/api/admin-notifications', { method: 'DELETE' }).catch(() => {});
  } catch {
    // ignore
  }
}

export function logClientCommand(
  entry: Omit<CommandLogEntry, 'id' | 'timestamp'> & { id?: string }
): CommandLogEntry | null {
  try {
    const existingRaw = localStorage.getItem(LOCAL_COMMAND_LOGS_KEY);
    const list: CommandLogEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
    const trimmedAudit = entry.audit
      ? {
          ...entry.audit,
          queryText: entry.audit.queryText?.slice(0, 500),
          inputPreview: entry.audit.inputPreview?.slice(0, 1200),
          outputPreview: entry.audit.outputPreview?.slice(0, 2200),
        }
      : undefined;

    const nextItem: CommandLogEntry = {
      ...entry,
      audit: trimmedAudit,
      id: entry.id || `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const safeList = Array.isArray(list) ? list : [];
    const existingIdx = safeList.findIndex((x) => x.id === nextItem.id);
    const updated = (
      existingIdx >= 0
        ? safeList.map((x, idx) =>
            idx === existingIdx
              ? { ...x, ...nextItem, audit: { ...(x.audit || {}), ...(nextItem.audit || {}) } }
              : x
          )
        : [nextItem, ...safeList]
    ).slice(0, 120);

    localStorage.setItem(LOCAL_COMMAND_LOGS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(COMMANDS_UPDATED_EVENT));
    }

    // Immediate Admin Notification for new orders or banned user access attempts
    if (existingIdx < 0) {
      if (nextItem.status === 'blocked') {
        pushAdminNotification({
          id: `notif_ban_${nextItem.id}`,
          type: 'banned_attempt',
          title: 'محاولة وصول من مستخدم محظور',
          message: `حاول المستخدم "${nextItem.userName}" الوصول إلى أداة (${nextItem.command})`,
          userId: nextItem.userId,
          userName: nextItem.userName,
          orderId: nextItem.id,
          command: nextItem.command,
          timestamp: nextItem.timestamp,
        });
      } else if (nextItem.status === 'success' || nextItem.status === 'started') {
        pushAdminNotification({
          id: `notif_ord_${nextItem.id}`,
          type: 'new_order',
          title: nextItem.status === 'success' ? 'تم تنفيذ طلب جديد' : 'بدء تنفيذ طلب جديد',
          message: `${nextItem.userName} · ${nextItem.command}: ${nextItem.details}`,
          userId: nextItem.userId,
          userName: nextItem.userName,
          orderId: nextItem.id,
          command: nextItem.command,
          timestamp: nextItem.timestamp,
        });
      }
    }

    // Best-effort non-blocking persistence to Express server orders DB
    if (typeof fetch !== 'undefined') {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextItem),
      }).catch(() => {
        // ignore offline/static mode
      });
    }

    return nextItem;
  } catch {
    return null;
  }
}

export function trackToolActivity(options: {
  id?: string;
  command: string;
  details: string;
  status?: CommandLogEntry['status'];
  audit?: CommandLogEntry['audit'];
}): CommandLogEntry | null {
  try {
    const rawUser =
      typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_USER_STORAGE_KEY) : null;
    const parsedUser: Partial<User> | null = rawUser ? JSON.parse(rawUser) : null;
    return logClientCommand({
      id: options.id,
      userId: parsedUser?.id || 'local_user',
      userName: parsedUser?.name || 'مستخدم Meta.Ny',
      command: options.command,
      details: options.details,
      status: options.status || 'success',
      audit: options.audit,
    });
  } catch {
    return null;
  }
}

export function getClientCommandLogs(): CommandLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_COMMAND_LOGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearClientCommandLogs(): void {
  try {
    localStorage.setItem(LOCAL_COMMAND_LOGS_KEY, JSON.stringify([]));
    if (typeof fetch !== 'undefined') {
      fetch('/api/orders', { method: 'DELETE' }).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(COMMANDS_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
}
