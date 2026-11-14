import { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_RETENTION_DAYS = new Set([3, 7, 14, 30]);

interface StoredFileMeta {
  fileId: string;
  diskName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  kind: 'original' | 'result';
  createdAt: string;
  retentionDays?: number;
  expiresAt?: string;
}

export interface ServerOrderRecord {
  id: string;
  userId: string;
  userName: string;
  command: string;
  details: string;
  status: 'success' | 'started' | 'blocked' | 'error';
  timestamp: string;
  audit?: Record<string, any>;
}

export interface ServerAdminNotification {
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

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.aac': 'audio/aac',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function inferMimeType(fileName: string, provided?: string): string {
  const ext = path.extname(fileName || '').toLowerCase();
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (provided && provided.trim()) return provided.trim();
  return 'application/octet-stream';
}

function sanitizeDownloadName(name: string): string {
  const cleaned = String(name || 'file')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .trim();
  return cleaned.slice(0, 160) || 'file';
}

function formatArabicDate(isoOrDate: Date | string): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function registerFileStorageRoutes(app: Express, dataDir: string): void {
  const uploadsDir = path.join(dataDir, 'uploads');
  const filesIndexPath = path.join(dataDir, 'files_index.json');
  const ordersFilePath = path.join(dataDir, 'orders.json');
  const settingsFilePath = path.join(dataDir, 'settings.json');
  const notificationsFilePath = path.join(dataDir, 'admin_notifications.json');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const readRetentionDays = (): number => {
    try {
      if (!fs.existsSync(settingsFilePath)) return 7;
      const parsed = JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8'));
      const val = Number(parsed?.retentionDays);
      return ALLOWED_RETENTION_DAYS.has(val) ? val : 7;
    } catch {
      return 7;
    }
  };

  const writeRetentionDays = (days: number): number => {
    const valid = ALLOWED_RETENTION_DAYS.has(days) ? days : 7;
    fs.writeFileSync(
      settingsFilePath,
      JSON.stringify({ retentionDays: valid, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    return valid;
  };

  const readFilesIndex = (): Record<string, StoredFileMeta> => {
    try {
      if (!fs.existsSync(filesIndexPath)) return {};
      const parsed = JSON.parse(fs.readFileSync(filesIndexPath, 'utf-8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeFilesIndex = (idx: Record<string, StoredFileMeta>) => {
    fs.writeFileSync(filesIndexPath, JSON.stringify(idx, null, 2), 'utf-8');
  };

  const readOrders = (): ServerOrderRecord[] => {
    try {
      if (!fs.existsSync(ordersFilePath)) return [];
      const parsed = JSON.parse(fs.readFileSync(ordersFilePath, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeOrders = (orders: ServerOrderRecord[]) => {
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders.slice(0, 300), null, 2), 'utf-8');
  };

  const readNotifications = (): ServerAdminNotification[] => {
    try {
      if (!fs.existsSync(notificationsFilePath)) return [];
      const parsed = JSON.parse(fs.readFileSync(notificationsFilePath, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeNotifications = (items: ServerAdminNotification[]) => {
    fs.writeFileSync(
      notificationsFilePath,
      JSON.stringify(items.slice(0, 200), null, 2),
      'utf-8'
    );
  };

  const pushNotification = (notif: Omit<ServerAdminNotification, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: string }) => {
    const list = readNotifications();
    const id = notif.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (list.some((n) => n.id === id)) return;
    const entry: ServerAdminNotification = {
      id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      userId: notif.userId,
      userName: notif.userName,
      orderId: notif.orderId,
      command: notif.command,
      timestamp: notif.timestamp || new Date().toISOString(),
      read: false,
    };
    writeNotifications([entry, ...list]);
  };

  const removeServerFileById = (fileId: string): boolean => {
    const cleanId = String(fileId || '').replace(/^server:\/\//, '').trim();
    if (!cleanId) return false;
    const idx = readFilesIndex();
    const meta = idx[cleanId];
    if (meta) {
      const fullPath = path.join(uploadsDir, meta.diskName);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore
        }
      }
      delete idx[cleanId];
      writeFilesIndex(idx);
      return true;
    }
    return false;
  };

  /**
   * Automatic Retention Expiry Sweep (7 days default or per-file stored retentionDays).
   * Never deletes user accounts or order records — deletes ONLY the stored files & clears URLs,
   * sets `autoDeleted: true`, and appends an admin notification log entry.
   */
  const runAutoCleanupSweep = (): { deletedCount: number; cleanedOrderIds: string[] } => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const dateLabel = formatArabicDate(nowIso);
    const cleanedOrderIds: string[] = [];

    // 1. Clean expired disk files in files_index.json
    const idx = readFilesIndex();
    let idxChanged = false;
    for (const [fId, meta] of Object.entries(idx)) {
      const retDays = meta.retentionDays || 7;
      const expMs = meta.expiresAt
        ? new Date(meta.expiresAt).getTime()
        : new Date(meta.createdAt).getTime() + retDays * DAY_MS;
      if (Number.isFinite(expMs) && now >= expMs) {
        const fullPath = path.join(uploadsDir, meta.diskName);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch {
            // ignore
          }
        }
        delete idx[fId];
        idxChanged = true;
      }
    }
    if (idxChanged) writeFilesIndex(idx);

    // 2. Clean expired order files while preserving order history record
    const orders = readOrders();
    let ordersChanged = false;
    const updatedOrders = orders.map((order) => {
      const audit = order.audit || {};
      if (audit.autoDeleted) return order;

      const hasStoredUrls = Boolean(
        audit.originalFileUrl ||
          audit.resultFileUrl ||
          audit.originalFileStoragePath ||
          audit.resultFileStoragePath
      );
      if (!hasStoredUrls && audit.filesDeletedFromServer) return order;

      const retDays = Number(audit.retentionDays) || 7;
      const baseCreatedMs = new Date(order.timestamp).getTime();
      const expMs = audit.expiresAt
        ? new Date(audit.expiresAt).getTime()
        : Number.isFinite(baseCreatedMs)
        ? baseCreatedMs + retDays * DAY_MS
        : NaN;

      if (Number.isFinite(expMs) && now >= expMs) {
        if (audit.originalFileStoragePath) removeServerFileById(audit.originalFileStoragePath);
        if (audit.resultFileStoragePath) removeServerFileById(audit.resultFileStoragePath);
        ordersChanged = true;
        cleanedOrderIds.push(order.id);

        if (hasStoredUrls) {
          pushNotification({
            id: `auto_del_${order.id}`,
            type: 'auto_delete',
            title: 'تم حذف الملف تلقائيا',
            message: `تم حذف الملف تلقائيا بتاريخ ${dateLabel} (${audit.attachedFileName || order.details})`,
            userId: order.userId,
            userName: order.userName,
            orderId: order.id,
            command: order.command,
            timestamp: nowIso,
          });
        }

        return {
          ...order,
          audit: {
            ...audit,
            originalFileUrl: '',
            originalFileStoragePath: '',
            resultFileUrl: '',
            resultFileStoragePath: '',
            filesDeletedFromServer: true,
            autoDeleted: true,
            autoDeletedAt: nowIso,
          },
        };
      }
      return order;
    });

    if (ordersChanged) {
      writeOrders(updatedOrders);
    }

    return { deletedCount: cleanedOrderIds.length, cleanedOrderIds };
  };

  // Run initial sweep at startup and scheduled sweep every 10 minutes
  runAutoCleanupSweep();
  const cleanupTimer = setInterval(runAutoCleanupSweep, 10 * 60 * 1000);
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  // Retention Settings endpoints
  app.get('/api/settings/retention', (_req: Request, res: Response) => {
    return res.json({ success: true, retentionDays: readRetentionDays() });
  });

  app.put('/api/settings/retention', (req: Request, res: Response) => {
    const requested = Number(req.body?.retentionDays);
    if (!ALLOWED_RETENTION_DAYS.has(requested)) {
      return res.status(400).json({
        success: false,
        error: 'Allowed retention durations are 3, 7, 14, or 30 days',
      });
    }
    const saved = writeRetentionDays(requested);
    return res.json({ success: true, retentionDays: saved });
  });

  // Admin Notifications endpoints
  app.get('/api/admin-notifications', (_req: Request, res: Response) => {
    runAutoCleanupSweep();
    return res.json({ success: true, notifications: readNotifications() });
  });

  app.post('/api/admin-notifications', (req: Request, res: Response) => {
    const { id, type, title, message, userId, userName, orderId, command, timestamp } = req.body || {};
    if (!type || !title || !message) {
      return res.status(400).json({ success: false, error: 'Invalid notification payload' });
    }
    pushNotification({
      id,
      type,
      title,
      message,
      userId,
      userName,
      orderId,
      command,
      timestamp,
    });
    return res.json({ success: true });
  });

  app.patch('/api/admin-notifications/read-all', (_req: Request, res: Response) => {
    const next = readNotifications().map((n) => ({ ...n, read: true }));
    writeNotifications(next);
    return res.json({ success: true });
  });

  app.delete('/api/admin-notifications', (_req: Request, res: Response) => {
    writeNotifications([]);
    return res.json({ success: true });
  });

  // Explicit cleanup trigger endpoint (called on admin dashboard open)
  app.post('/api/orders/cleanup', (_req: Request, res: Response) => {
    const result = runAutoCleanupSweep();
    return res.json({ success: true, ...result });
  });

  // Upload binary file (base64 payload up to 30MB decoded)
  app.post('/api/storage/upload', (req: Request, res: Response) => {
    try {
      const { fileName, mimeType, base64Data, kind, retentionDays: requestedDays } = req.body || {};
      if (!base64Data || typeof base64Data !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing file payload' });
      }

      const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const buf = Buffer.from(rawBase64, 'base64');
      if (buf.length === 0) {
        return res.status(400).json({ success: false, error: 'Empty file buffer' });
      }
      if (buf.length > 30 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'File exceeds 30MB server limit' });
      }

      const retentionDays = ALLOWED_RETENTION_DAYS.has(Number(requestedDays))
        ? Number(requestedDays)
        : readRetentionDays();
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + retentionDays * DAY_MS).toISOString();

      const safeName = sanitizeDownloadName(fileName || 'file');
      const fileId = crypto.randomUUID().replace(/-/g, '');
      const diskName = `${fileId}_${safeName}`;
      const fullPath = path.join(uploadsDir, diskName);

      fs.writeFileSync(fullPath, buf);

      const resolvedMime = inferMimeType(safeName, mimeType);
      const idx = readFilesIndex();
      idx[fileId] = {
        fileId,
        diskName,
        fileName: safeName,
        mimeType: resolvedMime,
        fileSize: buf.length,
        kind: kind === 'result' ? 'result' : 'original',
        createdAt,
        retentionDays,
        expiresAt,
      };
      writeFilesIndex(idx);

      const url = `/api/storage/file/${fileId}/${encodeURIComponent(safeName)}`;
      return res.json({
        success: true,
        fileId,
        storagePath: `server://${fileId}`,
        url,
        fileName: safeName,
        fileType: resolvedMime,
        fileSize: buf.length,
        retentionDays,
        expiresAt,
      });
    } catch (err: any) {
      console.error('Server upload error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Upload failed' });
    }
  });

  // Stream / download real stored file by ID (enforces expiry check)
  app.get('/api/storage/file/:fileId/:fileName?', (req: Request, res: Response) => {
    try {
      const fileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!fileId) {
        return res.status(400).json({ success: false, error: 'Invalid file ID' });
      }

      const idx = readFilesIndex();
      const meta = idx[fileId];
      if (!meta) {
        return res.status(404).json({ success: false, error: 'File not found on server' });
      }

      const retDays = meta.retentionDays || 7;
      const expMs = meta.expiresAt
        ? new Date(meta.expiresAt).getTime()
        : new Date(meta.createdAt).getTime() + retDays * DAY_MS;
      if (Number.isFinite(expMs) && Date.now() >= expMs) {
        removeServerFileById(fileId);
        return res.status(404).json({ success: false, error: 'File expired and was automatically deleted' });
      }

      const fullPath = path.join(uploadsDir, meta.diskName);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, error: 'Stored file missing on disk' });
      }

      const downloadMode = req.query.download === '1' || req.query.download === 'true';
      const mime = inferMimeType(meta.fileName, meta.mimeType);
      const encodedName = encodeURIComponent(meta.fileName);

      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader(
        'Content-Disposition',
        `${downloadMode ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedName}`
      );
      return res.sendFile(fullPath);
    } catch (err: any) {
      console.error('Server file read error:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to read file' });
    }
  });

  // Delete single file permanently from server disk
  app.delete('/api/storage/file/:fileId', (req: Request, res: Response) => {
    try {
      const fileId = String(req.params.fileId || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const removed = removeServerFileById(fileId);
      return res.json({ success: true, removed });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Delete failed' });
    }
  });

  // Orders DB persistence (runs sweep automatically on read)
  app.get('/api/orders', (_req: Request, res: Response) => {
    runAutoCleanupSweep();
    return res.json({ success: true, orders: readOrders() });
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    try {
      const order = req.body as ServerOrderRecord;
      if (!order || !order.id || !order.command) {
        return res.status(400).json({ success: false, error: 'Invalid order payload' });
      }
      const list = readOrders();
      const idx = list.findIndex((o) => o.id === order.id);

      const currentDefaultDays = readRetentionDays();
      const baseTs = order.timestamp ? new Date(order.timestamp).getTime() : Date.now();
      const incomingAudit = { ...(order.audit || {}) };
      if (!incomingAudit.retentionDays) {
        incomingAudit.retentionDays = currentDefaultDays;
      }
      if (!incomingAudit.expiresAt) {
        incomingAudit.expiresAt = new Date(
          (Number.isFinite(baseTs) ? baseTs : Date.now()) + Number(incomingAudit.retentionDays) * DAY_MS
        ).toISOString();
      }

      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...order,
          audit: { ...(list[idx].audit || {}), ...incomingAudit },
        };
      } else {
        const nextOrder: ServerOrderRecord = { ...order, audit: incomingAudit };
        list.unshift(nextOrder);

        if (order.status === 'blocked') {
          pushNotification({
            id: `notif_ban_${order.id}`,
            type: 'banned_attempt',
            title: 'محاولة وصول من مستخدم محظور',
            message: `حاول المستخدم "${order.userName}" الوصول إلى أداة (${order.command})`,
            userId: order.userId,
            userName: order.userName,
            orderId: order.id,
            command: order.command,
          });
        } else if (order.status === 'success' || order.status === 'started') {
          pushNotification({
            id: `notif_ord_${order.id}`,
            type: 'new_order',
            title: order.status === 'success' ? 'تم تنفيذ طلب جديد' : 'بدء طلب جديد',
            message: `${order.userName} · ${order.command}: ${order.details}`,
            userId: order.userId,
            userName: order.userName,
            orderId: order.id,
            command: order.command,
          });
        }
      }

      writeOrders(list);
      return res.json({ success: true, order: idx >= 0 ? list[idx] : list[0] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to save order' });
    }
  });

  app.patch('/api/orders/:id', (req: Request, res: Response) => {
    try {
      const orderId = String(req.params.id || '');
      const list = readOrders();
      const idx = list.findIndex((o) => o.id === orderId);
      if (idx < 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      const patch = req.body || {};
      list[idx] = {
        ...list[idx],
        ...patch,
        audit: { ...(list[idx].audit || {}), ...(patch.audit || {}) },
      };
      writeOrders(list);
      return res.json({ success: true, order: list[idx] });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to update order' });
    }
  });

  app.delete('/api/orders/:id/files', (req: Request, res: Response) => {
    try {
      const orderId = String(req.params.id || '');
      const list = readOrders();
      const idx = list.findIndex((o) => o.id === orderId);
      if (idx >= 0) {
        const audit = list[idx].audit || {};
        if (audit.originalFileStoragePath) removeServerFileById(audit.originalFileStoragePath);
        if (audit.resultFileStoragePath) removeServerFileById(audit.resultFileStoragePath);
        list[idx] = {
          ...list[idx],
          audit: {
            ...audit,
            originalFileUrl: '',
            originalFileStoragePath: '',
            resultFileUrl: '',
            resultFileStoragePath: '',
            filesDeletedFromServer: true,
          },
        };
        writeOrders(list);
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to delete order files' });
    }
  });

  app.delete('/api/orders', (_req: Request, res: Response) => {
    writeOrders([]);
    return res.json({ success: true });
  });
}
