import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email?: string | null;
}

interface GitHubSession {
  token: string;
  user: GitHubUser;
  connectedAt: string;
}

interface PendingOAuthState {
  adminEmail: string;
  redirectUri: string;
  createdAt: number;
}

export interface ProjectFileEntry {
  relativePath: string;
  buffer: Buffer;
  size: number;
}

const COOKIE_NAME = 'metany_gh_sid';
const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'dev-dist',
  'build',
  'coverage',
  '.git',
  '.aistudio',
  'data',
]);

const EXCLUDE_FILES = new Set([
  '.DS_Store',
  'MetaNy-Complete-Site.zip',
]);

// Server-side in-memory stores for OAuth sessions and CSRF states
const githubSessions = new Map<string, GitHubSession>();
const adminTokenByEmail = new Map<string, GitHubSession>();
const pendingOAuthStates = new Map<string, PendingOAuthState>();

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  const result: Record<string, string> = {};
  if (!header) return result;

  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function shouldExcludeFile(fileName: string): boolean {
  if (EXCLUDE_FILES.has(fileName)) return true;
  if (fileName.endsWith('.log')) return true;
  if (fileName.startsWith('.env') && fileName !== '.env.example') return true;
  return false;
}

export function collectProjectFiles(rootDir: string = process.cwd()): ProjectFileEntry[] {
  const entries: ProjectFileEntry[] = [];

  function walk(currentDir: string) {
    const dirItems = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of dirItems) {
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        if (!EXCLUDE_DIRS.has(item.name)) {
          walk(fullPath);
        }
      } else if (item.isFile()) {
        if (!shouldExcludeFile(item.name)) {
          const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          const buffer = fs.readFileSync(fullPath);
          entries.push({
            relativePath,
            buffer,
            size: buffer.length,
          });
        }
      }
    }
  }

  walk(rootDir);
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return entries;
}

export async function buildProjectZipBuffer(rootDir: string = process.cwd()): Promise<{
  zipBuffer: Buffer;
  fileCount: number;
  rawBytes: number;
}> {
  const files = collectProjectFiles(rootDir);
  const zip = new JSZip();

  let rawBytes = 0;
  for (const f of files) {
    zip.file(f.relativePath, f.buffer);
    rawBytes += f.size;
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    zipBuffer,
    fileCount: files.length,
    rawBytes,
  };
}

function resolveRedirectUri(req: Request): string {
  const envAppUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envAppUrl) {
    return `${envAppUrl}/auth/callback`;
  }
  const clientOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim().replace(/\/+$/, '') : '';
  if (clientOrigin && (clientOrigin.startsWith('https://') || clientOrigin.startsWith('http://localhost'))) {
    return `${clientOrigin}/auth/callback`;
  }
  return 'http://localhost:3000/auth/callback';
}

function getGitHubSession(req: Request, isAdminEmail: (email: string) => boolean): GitHubSession | null {
  const cookies = parseCookies(req);
  const sid = cookies[COOKIE_NAME];
  if (sid && githubSessions.has(sid)) {
    return githubSessions.get(sid) || null;
  }
  const adminEmail = ((req.headers['x-admin-email'] as string) || '').toLowerCase().trim();
  if (adminEmail && isAdminEmail(adminEmail) && adminTokenByEmail.has(adminEmail)) {
    return adminTokenByEmail.get(adminEmail) || null;
  }
  return null;
}

async function githubApiRequest<T = any>(
  token: string,
  apiPath: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const url = apiPath.startsWith('https://') ? apiPath : `https://api.github.com${apiPath}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'MetaNy-App-Sync',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const err: any = new Error(data?.message || `GitHub API error (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

export function registerGitHubRoutes(
  app: express.Express,
  isAdminEmail: (email: string) => boolean
) {
  // Helper middleware verifying Admin access on all /api/github/* endpoints
  const requireAdmin = (req: Request, res: Response, next: express.NextFunction) => {
    const adminEmail = ((req.headers['x-admin-email'] as string) || '').toLowerCase().trim();
    if (!isAdminEmail(adminEmail)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin credentials required.',
      });
    }
    next();
  };

  // 1. GitHub integration status & complete ZIP project stats
  app.get('/api/github/status', requireAdmin, (req: Request, res: Response) => {
    try {
      const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
      const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();
      const oauthConfigured = Boolean(clientId && clientSecret);
      const redirectUri = resolveRedirectUri(req);
      const session = getGitHubSession(req, isAdminEmail);
      const files = collectProjectFiles();
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

      res.json({
        success: true,
        oauthConfigured,
        connected: Boolean(session),
        user: session?.user || null,
        connectedAt: session?.connectedAt || null,
        redirectUri,
        projectStats: {
          totalFiles: files.length,
          totalBytes,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to read GitHub status' });
    }
  });

  // 2. Construct GitHub OAuth Authorization URL (popup opens GitHub directly)
  app.get('/api/github/auth/url', requireAdmin, (req: Request, res: Response) => {
    const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_GITHUB_OAUTH_ENV',
        error: 'GitHub OAuth environment variables (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET) are not configured yet.',
        redirectUri: resolveRedirectUri(req),
      });
    }

    const adminEmail = ((req.headers['x-admin-email'] as string) || '').toLowerCase().trim();
    const redirectUri = resolveRedirectUri(req);
    const state = crypto.randomBytes(24).toString('hex');

    // Clean stale states older than 10 minutes
    const now = Date.now();
    for (const [k, v] of pendingOAuthStates.entries()) {
      if (now - v.createdAt > 10 * 60 * 1000) {
        pendingOAuthStates.delete(k);
      }
    }

    pendingOAuthStates.set(state, {
      adminEmail,
      redirectUri,
      createdAt: now,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo user:email',
      state,
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    res.json({ success: true, url: authUrl, redirectUri });
  });

  // 3. OAuth Callback Handler (registers both /auth/callback and /auth/callback/)
  const callbackHandler = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    const oauthErrorDesc = typeof req.query.error_description === 'string' ? req.query.error_description : '';

    const sendPopupResult = (payload: Record<string, any>, messageHtml: string) => {
      const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GitHub OAuth - Meta.Ny</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; max-width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
  </style>
</head>
<body>
  <div class="card">
    ${messageHtml}
  </div>
  <script>
    (function() {
      var data = ${safeJson};
      if (window.opener) {
        window.opener.postMessage(data, '*');
        setTimeout(function() { window.close(); }, 600);
      } else {
        setTimeout(function() { window.location.href = '/'; }, 1200);
      }
    })();
  </script>
</body>
</html>`);
    };

    if (oauthError) {
      return sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: oauthErrorDesc || oauthError },
        `<h3>GitHub Authorization Cancelled</h3><p>${oauthErrorDesc || oauthError}</p>`
      );
    }

    const stateMeta = state ? pendingOAuthStates.get(state) : undefined;
    if (!code || !state || !stateMeta) {
      return sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: 'Invalid or expired OAuth state parameter.' },
        `<h3>Authentication Failed</h3><p>Invalid or expired OAuth session state. Please try connecting again.</p>`
      );
    }

    pendingOAuthStates.delete(state);

    const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();

    if (!clientId || !clientSecret) {
      return sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: 'Server missing GitHub OAuth credentials.' },
        `<h3>Configuration Error</h3><p>Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET.</p>`
      );
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: stateMeta.redirectUri,
        }),
      });

      const tokenData: any = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to obtain GitHub access token');
      }

      const accessToken: string = tokenData.access_token;
      const ghUser = await githubApiRequest<GitHubUser>(accessToken, '/user');

      const sessionObj: GitHubSession = {
        token: accessToken,
        user: {
          id: ghUser.id,
          login: ghUser.login,
          name: ghUser.name,
          avatar_url: ghUser.avatar_url,
          html_url: ghUser.html_url,
          email: ghUser.email,
        },
        connectedAt: new Date().toISOString(),
      };

      const sid = crypto.randomBytes(24).toString('hex');
      githubSessions.set(sid, sessionObj);
      if (stateMeta.adminEmail && isAdminEmail(stateMeta.adminEmail)) {
        adminTokenByEmail.set(stateMeta.adminEmail, sessionObj);
      }

      res.cookie(COOKIE_NAME, sid, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 24 * 7,
        path: '/',
      });

      return sendPopupResult(
        { type: 'GITHUB_OAUTH_SUCCESS', user: sessionObj.user },
        `<h3>Connected to GitHub as @${sessionObj.user.login}</h3><p>This window will close automatically...</p>`
      );
    } catch (err: any) {
      return sendPopupResult(
        { type: 'GITHUB_OAUTH_ERROR', error: err.message || 'OAuth token exchange failed' },
        `<h3>GitHub Connection Error</h3><p>${err.message || 'Unexpected error'}</p>`
      );
    }
  };

  app.get(['/auth/callback', '/auth/callback/'], callbackHandler);

  // 4. Disconnect GitHub OAuth session
  app.post('/api/github/disconnect', requireAdmin, (req: Request, res: Response) => {
    const cookies = parseCookies(req);
    const sid = cookies[COOKIE_NAME];
    if (sid) githubSessions.delete(sid);

    const adminEmail = ((req.headers['x-admin-email'] as string) || '').toLowerCase().trim();
    if (adminEmail) adminTokenByEmail.delete(adminEmail);

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });

    res.json({ success: true });
  });

  // 5. Download Complete Website as a Single ZIP File
  app.get('/api/github/export-zip', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const { zipBuffer } = await buildProjectZipBuffer();
      const dateTag = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="MetaNy-Complete-Site-${dateTag}.zip"`);
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.send(zipBuffer);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to generate complete site ZIP' });
    }
  });

  // 6. List Authenticated User's GitHub Repositories
  app.get('/api/github/repos', requireAdmin, async (req: Request, res: Response) => {
    const session = getGitHubSession(req, isAdminEmail);
    if (!session) {
      return res.status(401).json({ success: false, error: 'GitHub account is not connected.' });
    }

    try {
      const repos = await githubApiRequest<any[]>(
        session.token,
        '/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator'
      );

      res.json({
        success: true,
        repos: repos.map((r) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          private: r.private,
          html_url: r.html_url,
          default_branch: r.default_branch || 'main',
          updated_at: r.updated_at,
        })),
      });
    } catch (err: any) {
      if (err.status === 401) {
        return res.status(401).json({ success: false, error: 'GitHub session expired. Please reconnect.' });
      }
      res.status(err.status || 500).json({ success: false, error: err.message || 'Failed to list repositories' });
    }
  });

  // 7. Push Complete Site Source Code + Optional Complete ZIP Archive to GitHub Repository
  app.post('/api/github/push', requireAdmin, async (req: Request, res: Response) => {
    const session = getGitHubSession(req, isAdminEmail);
    if (!session) {
      return res.status(401).json({ success: false, error: 'GitHub account is not connected.' });
    }

    const {
      mode = 'new',
      repoName = 'metany-ai-platform',
      existingFullName = '',
      description = 'Meta.Ny AI Document & Academic Suite - Full Website Source & Complete ZIP Backup',
      isPrivate = true,
      branch: requestedBranch,
      commitMessage = `Sync complete Meta.Ny website & ZIP archive (${new Date().toISOString().slice(0, 10)})`,
      includeZipBundle = true,
    } = req.body || {};

    try {
      let owner = session.user.login;
      let repo = repoName.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
      let targetBranch = (requestedBranch || '').trim() || 'main';
      let repoHtmlUrl = '';

      if (mode === 'new') {
        if (!repo) {
          return res.status(400).json({ success: false, error: 'Repository name is required.' });
        }

        const createdRepo = await githubApiRequest<any>(session.token, '/user/repos', {
          method: 'POST',
          body: {
            name: repo,
            description,
            private: Boolean(isPrivate),
            auto_init: true,
          },
        });

        owner = createdRepo.owner?.login || owner;
        repo = createdRepo.name || repo;
        targetBranch = createdRepo.default_branch || 'main';
        repoHtmlUrl = createdRepo.html_url;

        // Wait briefly for GitHub auto_init commit to settle
        await new Promise((r) => setTimeout(r, 1200));
      } else {
        if (!existingFullName || !existingFullName.includes('/')) {
          return res.status(400).json({ success: false, error: 'Please select a valid target repository.' });
        }
        const [parsedOwner, parsedRepo] = existingFullName.split('/');
        owner = parsedOwner;
        repo = parsedRepo;
        const repoInfo = await githubApiRequest<any>(session.token, `/repos/${owner}/${repo}`);
        targetBranch = (requestedBranch || '').trim() || repoInfo.default_branch || 'main';
        repoHtmlUrl = repoInfo.html_url;
      }

      // Ensure branch ref exists (handle completely empty repos gracefully)
      let headCommitSha: string | null = null;
      let baseTreeSha: string | null = null;

      try {
        const refData = await githubApiRequest<any>(
          session.token,
          `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(targetBranch)}`
        );
        headCommitSha = refData.object?.sha || null;
      } catch (refErr: any) {
        // Repo might be empty (409 or 404); initialize with README via Contents API
        if (refErr.status === 404 || refErr.status === 409) {
          const initRes = await githubApiRequest<any>(
            session.token,
            `/repos/${owner}/${repo}/contents/README.md`,
            {
              method: 'PUT',
              body: {
                message: 'Initialize repository for Meta.Ny full site sync',
                content: Buffer.from('# Meta.Ny AI Platform\n').toString('base64'),
                branch: targetBranch,
              },
            }
          );
          headCommitSha = initRes.commit?.sha || null;
        } else {
          throw refErr;
        }
      }

      if (headCommitSha) {
        const commitObj = await githubApiRequest<any>(
          session.token,
          `/repos/${owner}/${repo}/git/commits/${headCommitSha}`
        );
        baseTreeSha = commitObj.tree?.sha || null;
      }

      // Collect all website files + optional complete ZIP archive
      const projectFiles = collectProjectFiles();
      const uploadEntries: Array<{ path: string; buffer: Buffer }> = projectFiles.map((f) => ({
        path: f.relativePath,
        buffer: f.buffer,
      }));

      let zipSizeBytes = 0;
      if (includeZipBundle) {
        const { zipBuffer } = await buildProjectZipBuffer();
        zipSizeBytes = zipBuffer.length;
        uploadEntries.push({
          path: 'MetaNy-Complete-Site.zip',
          buffer: zipBuffer,
        });
      }

      // Upload Git blobs in concurrency batches of 6
      const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
      const BATCH_SIZE = 6;

      for (let i = 0; i < uploadEntries.length; i += BATCH_SIZE) {
        const slice = uploadEntries.slice(i, i + BATCH_SIZE);
        const createdBlobs = await Promise.all(
          slice.map(async (entry) => {
            const blob = await githubApiRequest<{ sha: string }>(
              session.token,
              `/repos/${owner}/${repo}/git/blobs`,
              {
                method: 'POST',
                body: {
                  content: entry.buffer.toString('base64'),
                  encoding: 'base64',
                },
              }
            );
            return {
              path: entry.path,
              mode: '100644',
              type: 'blob',
              sha: blob.sha,
            };
          })
        );
        treeItems.push(...createdBlobs);
      }

      // Create Git tree
      const treePayload: any = { tree: treeItems };
      if (baseTreeSha) {
        treePayload.base_tree = baseTreeSha;
      }
      const createdTree = await githubApiRequest<{ sha: string }>(
        session.token,
        `/repos/${owner}/${repo}/git/trees`,
        {
          method: 'POST',
          body: treePayload,
        }
      );

      // Create commit
      const commitPayload: any = {
        message: commitMessage,
        tree: createdTree.sha,
      };
      if (headCommitSha) {
        commitPayload.parents = [headCommitSha];
      }
      const createdCommit = await githubApiRequest<{ sha: string; html_url: string }>(
        session.token,
        `/repos/${owner}/${repo}/git/commits`,
        {
          method: 'POST',
          body: commitPayload,
        }
      );

      // Update branch ref
      await githubApiRequest(
        session.token,
        `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(targetBranch)}`,
        {
          method: 'PATCH',
          body: {
            sha: createdCommit.sha,
            force: true,
          },
        }
      );

      res.json({
        success: true,
        repoFullName: `${owner}/${repo}`,
        repoUrl: repoHtmlUrl || `https://github.com/${owner}/${repo}`,
        commitSha: createdCommit.sha,
        commitUrl: createdCommit.html_url || `https://github.com/${owner}/${repo}/commit/${createdCommit.sha}`,
        branch: targetBranch,
        filesCount: uploadEntries.length,
        includedZip: Boolean(includeZipBundle),
        zipSizeBytes,
      });
    } catch (err: any) {
      console.error('GitHub push error:', err);
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to push project to GitHub',
      });
    }
  });
}
