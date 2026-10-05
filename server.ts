import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const CONFIG_FILE = path.join(__dirname, 'config_multi.json');
const OLD_CONFIG_FILE = path.join(__dirname, 'config.json');
const AUTH_FILE = path.join(__dirname, 'auth.json');

// Session storage: token -> { username: string, expiresAt: number }
const activeSessions = new Map<string, { username: string; expiresAt: number }>();

// Brute-force protection: ip -> { count: number, lockedUntil: number }
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

interface AuthConfig {
  username: string;
  passwordHash: string;
  salt: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Constant-time string comparison to avoid timing attacks
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Files that must never be served over HTTP (contain tokens / password hashes / source)
const BLOCKED_PATH_PATTERN = /(^|\/)(auth\.json|config(_multi)?\.json|server\.ts|package(-lock)?\.json|tsconfig\.json|\.env.*|.*\.zip|\.git)(\/|$)/i;

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Resolve a valid session from the Authorization header (returns token + session, or null)
function getSessionFromRequest(req: Request): { token: string; session: { username: string; expiresAt: number } } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return { token, session };
}

function getAuthConfig(): AuthConfig {
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      if (data.username && data.passwordHash && data.salt) {
        return data;
      }
    } catch {
      // Fallback
    }
  }

  // Default credentials: admin / admin
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword('admin', salt);
  const defaultConfig: AuthConfig = {
    username: 'admin',
    passwordHash,
    salt,
  };
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to create default auth.json:', err);
  }
  return defaultConfig;
}

function saveAuthConfig(config: AuthConfig) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// Authentication middleware to block unauthorized access
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const found = getSessionFromRequest(req);
  if (!found) {
    return res.status(401).json({ error: 'Unauthorized: Session invalid or expired' });
  }

  // Prolong session on activity (sliding 24h expiration)
  found.session.expiresAt = Date.now() + SESSION_TTL_MS;
  next();
}

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
  nextPostAt?: number; // epoch ms
}

export interface AccountData {
  id: string;
  name: string;
  token: string;
  useWebhook: boolean;
  webhookUrl: string;
  channels: ChannelItem[];
  isRunning: boolean;
  userProfile?: {
    id: string;
    username: string;
    discriminator: string;
    globalName?: string;
    avatar?: string;
    avatarUrl?: string;
  };
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

// In-memory state
let accounts: AccountData[] = [];
let logs: LogEntry[] = [];
const activeTimers: Map<string, NodeJS.Timeout[]> = new Map(); // key: accountId -> list of timers

// Helper: parse Spintax e.g. "{hello|hi|hey} everyone {morning|afternoon}"
function parseSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  return text.replace(spintaxRegex, (_, choices) => {
    const options = choices.split('|');
    return options[Math.floor(Math.random() * options.length)].trim();
  });
}

// Helper: process message variables like {time}, {date}, {random_num}, {counter}
function processMessageVariables(text: string, counter: number = 1): string {
  let result = parseSpintax(text);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US');
  const randomNum = Math.floor(1000 + Math.random() * 9000);

  result = result
    .replace(/\{time\}/gi, timeStr)
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{random_num\}/gi, String(randomNum))
    .replace(/\{counter\}/gi, String(counter));

  return result;
}

// Load initial config from disk
function loadInitialConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed.accounts)) {
        accounts = parsed.accounts.map((acc: AccountData) => ({
          ...acc,
          isRunning: false, // Start stopped initially on server boot
        }));
        console.log(`[Config] Loaded ${accounts.length} accounts from ${CONFIG_FILE}`);
        return;
      }
    } catch (e) {
      console.error('[Config] Error loading config_multi.json:', e);
    }
  }

  // Fallback: migrate from old single-account config.json if exists
  if (fs.existsSync(OLD_CONFIG_FILE)) {
    try {
      const oldData = fs.readFileSync(OLD_CONFIG_FILE, 'utf-8');
      const oldConfig = JSON.parse(oldData);
      const migratedChannels: ChannelItem[] = (oldConfig.channels || []).map((ch: any, idx: number) => {
        const interval = ch.interval || 60;
        const hours = Math.floor(interval / 3600);
        const minutes = Math.floor((interval % 3600) / 60);
        const seconds = interval % 60;
        return {
          id: `ch_${Date.now()}_${idx}`,
          channelId: ch.id || '',
          channelName: `Channel ${idx + 1}`,
          message: ch.message || '',
          hours,
          minutes,
          seconds,
          interval,
          enabled: true,
        };
      });

      accounts = [
        {
          id: `acc_${Date.now()}_1`,
          name: 'Akun 1 (Imported)',
          token: oldConfig.token || '',
          useWebhook: !!oldConfig.use_webhook,
          webhookUrl: oldConfig.webhook_url || '',
          channels: migratedChannels.length > 0 ? migratedChannels : [
            {
              id: `ch_${Date.now()}_1`,
              channelId: '',
              channelName: 'Target Channel 1',
              message: '',
              hours: 0,
              minutes: 2,
              seconds: 0,
              interval: 120,
              enabled: true,
            }
          ],
          isRunning: false,
          stats: {
            sentCount: 0,
            failedCount: 0,
          },
        },
      ];
      saveConfigToDisk();
      console.log('[Config] Migrated old config.json to multi-account config');
      return;
    } catch (err) {
      console.error('[Config] Error migrating old config.json:', err);
    }
  }

  // Default initial account if nothing exists
  accounts = [
    {
      id: 'acc_1',
      name: 'Account 1',
      token: '',
      useWebhook: false,
      webhookUrl: '',
      channels: [
        {
          id: 'ch_1',
          channelId: '',
          channelName: 'Channel #1',
          message: '',
          hours: 0,
          minutes: 2,
          seconds: 0,
          interval: 120,
          enabled: true,
        },
      ],
      isRunning: false,
      stats: {
        sentCount: 0,
        failedCount: 0,
      },
    },
  ];
  saveConfigToDisk();
}

function saveConfigToDisk() {
  try {
    const cleanAccounts = accounts.map(acc => ({
      ...acc,
      // Persist config fields, keep isRunning state
      isRunning: acc.isRunning,
    }));
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ accounts: cleanAccounts, updatedAt: new Date().toISOString() }, null, 2));
  } catch (err) {
    console.error('[Config] Failed to save config to disk:', err);
  }
}

function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
  const newEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
    ...entry,
  };
  logs.unshift(newEntry);
  if (logs.length > 200) {
    logs.pop();
  }
}

// Send Webhook embed
async function sendDiscordWebhook(webhookUrl: string, payload: {
  accountName: string;
  usernameTag: string;
  channelId: string;
  messageText: string;
  statusMessage: string;
  success: boolean;
}) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) return;

  try {
    const now = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const embed = {
      title: '🎁 Auto Post Discord (Multi-Account) 🎁',
      description: `> **Account: ${payload.accountName}**`,
      color: payload.success ? 0x00ff00 : 0xff0000,
      fields: [
        {
          name: '🟢 Status Log',
          value: payload.success ? '> Success' : '> Failed',
          inline: true,
        },
        {
          name: '🕴 Username',
          value: payload.usernameTag ? `> ${payload.usernameTag}` : '> <@me>',
          inline: true,
        },
        {
          name: '🕓 Date Time',
          value: `> ${now}`,
          inline: false,
        },
        {
          name: '📺 Channel Target',
          value: payload.channelId ? `> <#${payload.channelId}>` : '> Unknown',
          inline: true,
        },
        {
          name: '📝 Status Details',
          value: `> ${payload.statusMessage}`,
          inline: false,
        },
        {
          name: '💬 Content Preview',
          value: `\`\`\`${payload.messageText.slice(0, 150)}${payload.messageText.length > 150 ? '...' : ''}\`\`\``,
          inline: false,
        }
      ],
      image: {
        url: 'https://cdn.discordapp.com/attachments/1222659397477097572/1226427380985126922/image.png',
      },
      footer: {
        text: 'Discord Multi-Account Auto Poster',
      },
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err: any) {
    console.error('[Webhook Error]', err.message);
  }
}

// Send Discord message to a channel
async function sendDiscordMessage(token: string, channelId: string, content: string): Promise<{ success: boolean; status: number; text: string }> {
  if (!token || !channelId) {
    return { success: false, status: 400, text: 'Token or Channel ID is required' };
  }

  const authHeader = token.trim();

  const url = `https://discord.com/api/v10/channels/${channelId.trim()}/messages`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ content }),
    });

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {}

    if (response.status === 200 || response.status === 201 || response.status === 204) {
      return { success: true, status: response.status, text: 'Message successfully sent to Discord!' };
    }

    if (response.status === 429) {
      const retryAfter = resJson?.retry_after || 5;
      return { success: false, status: 429, text: `Discord Rate Limit reached! Wait ${retryAfter}s.` };
    }

    if (response.status === 401) {
      return { success: false, status: 401, text: 'Invalid or expired Discord token (401 Unauthorized).' };
    }

    if (response.status === 403) {
      return { success: false, status: 403, text: 'Missing permission to send message in this channel (403 Forbidden).' };
    }

    if (response.status === 404) {
      return { success: false, status: 404, text: 'Channel ID not found or account not in server (404 Not Found).' };
    }

    return {
      success: false,
      status: response.status,
      text: resJson?.message || `Discord Error [${response.status}] ${resText.slice(0, 100)}`,
    };
  } catch (err: any) {
    return { success: false, status: 500, text: `Connection error: ${err.message}` };
  }
}

// Validate Discord token and get user profile
async function fetchDiscordUserProfile(token: string) {
  if (!token) return null;
  const authHeader = token.trim();

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const user = await res.json();
      let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
      if (user.avatar) {
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
      }
      return {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator || '0',
        globalName: user.global_name || user.username,
        avatar: user.avatar,
        avatarUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Background poster routine for a channel
function scheduleChannelPosting(account: AccountData, channel: ChannelItem) {
  const accountId = account.id;
  const intervalSeconds = Math.max(5, channel.interval || 60);

  const doPost = async () => {
    // Re-check if account still active
    const currentAcc = accounts.find(a => a.id === accountId);
    if (!currentAcc || !currentAcc.isRunning) {
      return false;
    }

    const currChannel = currentAcc.channels.find(c => c.id === channel.id);
    if (!currChannel || currChannel.enabled === false) {
      return true;
    }

    const messageToSend = processMessageVariables(currChannel.message, (currentAcc.stats.sentCount || 0) + 1);

    const result = await sendDiscordMessage(currentAcc.token, currChannel.channelId, messageToSend);

    const nowIso = new Date().toISOString();
    currChannel.lastPostedAt = nowIso;
    currChannel.nextPostAt = Date.now() + intervalSeconds * 1000;

    if (result.success) {
      currentAcc.stats.sentCount = (currentAcc.stats.sentCount || 0) + 1;
      currentAcc.stats.lastSuccess = true;
      currentAcc.stats.lastStatusMessage = `Sent to #${currChannel.channelId}`;
    } else {
      currentAcc.stats.failedCount = (currentAcc.stats.failedCount || 0) + 1;
      currentAcc.stats.lastSuccess = false;
      currentAcc.stats.lastStatusMessage = `Failed #${currChannel.channelId}: ${result.text}`;
    }
    currentAcc.stats.lastPostedAt = nowIso;

    // Log entry
    addLog({
      accountId: currentAcc.id,
      accountName: currentAcc.name,
      channelId: currChannel.channelId,
      success: result.success,
      message: messageToSend,
      statusText: result.text,
    });

    // Webhook alert if configured
    if (currentAcc.useWebhook && currentAcc.webhookUrl) {
      const usernameTag = currentAcc.userProfile ? `${currentAcc.userProfile.username}` : currentAcc.name;
      sendDiscordWebhook(currentAcc.webhookUrl, {
        accountName: currentAcc.name,
        usernameTag,
        channelId: currChannel.channelId,
        messageText: messageToSend,
        statusMessage: result.text,
        success: result.success,
      });
    }

    saveConfigToDisk();
    return true;
  };

  // Set initial countdown: first post triggers after 1.2s
  channel.nextPostAt = Date.now() + 1200;
  const initialTimeout = setTimeout(async () => {
    await doPost();
  }, 1200);

  // Recurring posting timer
  const timer = setInterval(async () => {
    const active = await doPost();
    if (!active) {
      clearInterval(timer);
    }
  }, intervalSeconds * 1000);

  if (!activeTimers.has(accountId)) {
    activeTimers.set(accountId, []);
  }
  activeTimers.get(accountId)!.push(initialTimeout as unknown as NodeJS.Timeout);
  activeTimers.get(accountId)!.push(timer);
}

// Start posting for an account
function startAccount(accountId: string): boolean {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return false;
  if (!account.token) return false;

  stopAccount(accountId); // Clear any existing timers first

  account.isRunning = true;

  const validChannels = account.channels.filter(c => c.channelId && c.channelId.trim() !== '' && c.enabled !== false);
  if (validChannels.length === 0) {
    // Still marked as running, but has no valid channels yet
    saveConfigToDisk();
    return true;
  }

  for (const ch of validChannels) {
    scheduleChannelPosting(account, ch);
  }

  addLog({
    accountId: account.id,
    accountName: account.name,
    channelId: validChannels.map(c => c.channelId).join(', '),
    success: true,
    message: `Started auto post for ${validChannels.length} channel(s).`,
    statusText: 'Account Active',
  });

  saveConfigToDisk();
  return true;
}

// Stop posting for an account
function stopAccount(accountId: string): boolean {
  const account = accounts.find(a => a.id === accountId);
  if (!account) return false;

  account.isRunning = false;

  const timers = activeTimers.get(accountId);
  if (timers && timers.length > 0) {
    timers.forEach(t => clearInterval(t));
    activeTimers.delete(accountId);
  }

  // Clear countdowns
  account.channels.forEach(ch => {
    ch.nextPostAt = undefined;
  });

  addLog({
    accountId: account.id,
    accountName: account.name,
    channelId: '-',
    success: true,
    message: 'Auto post stopped for this account.',
    statusText: 'Account Stopped',
  });

  saveConfigToDisk();
  return true;
}

// Generate Standalone Multi-Account Python Script (Termux / Windows ready)
function generateMultiAccountPythonScript(accs: AccountData[]): string {
  return `"""
Auto Post Discord Multi-Account
Generated by Auto Poster Controller
Compatible with Termux (Android) and Windows / Linux
Requirements: pip install requests
"""

import time
import threading
import json
import os
import requests

CONFIG = ${JSON.stringify({ accounts: accs }, null, 4)}

def parse_spintax(text):
    import re, random
    pattern = r'\\{([^\\{\\}]+)\\}'
    while re.search(pattern, text):
        text = re.sub(pattern, lambda m: random.choice(m.group(1).split('|')).strip(), text)
    return text

def process_variables(text, counter=1):
    import random
    text = parse_spintax(text)
    now = time.strftime("%H:%M:%S")
    date_str = time.strftime("%Y-%m-%d")
    random_num = str(random.randint(1000, 9999))
    text = text.replace("{time}", now)
    text = text.replace("{date}", date_str)
    text = text.replace("{counter}", str(counter))
    text = text.replace("{random_num}", random_num)
    return text

def send_webhook(webhook_url, account_name, channel_id, message, success, status_info):
    if not webhook_url:
        return
    now = time.strftime("%d %B %Y %I:%M:%S %p")
    embed = {
        "title": "🎁 Discord Auto Post (Multi-Account) 🎁",
        "description": f"> **Account: {account_name}**",
        "color": 65280 if success else 16711680,
        "fields": [
            {"name": "🟢 Status Log", "value": "> Success" if success else "> Failed", "inline": True},
            {"name": "📺 Channel Target", "value": f"> <#{channel_id}>", "inline": True},
            {"name": "🕓 Date & Time", "value": f"> {now}", "inline": False},
            {"name": "✅ Status Info", "value": f"> {status_info}", "inline": False},
            {"name": "💬 Message Sent", "value": f"\`\`\`{message[:150]}\`\`\`", "inline": False}
        ],
        "image": {
            "url": "https://cdn.discordapp.com/attachments/1222659397477097572/1226427380985126922/image.png"
        },
        "footer": {"text": "Discord Multi-Account Auto Poster"}
    }
    try:
        requests.post(webhook_url, json={"embeds": [embed]}, timeout=10)
    except Exception as e:
        print(f"[{account_name}] Webhook Error: {e}")

def post_channel_loop(account, channel):
    token = account.get("token", "").strip()
    channel_id = channel.get("channelId", "").strip()
    interval = max(5, int(channel.get("interval", 60)))
    raw_message = channel.get("message", "")
    account_name = account.get("name", "Unknown Account")

    print(f"[{account_name}] Started posting to #{channel_id} every {interval}s")
    counter = 1

    while True:
        try:
            content = process_variables(raw_message, counter)
            url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
            headers = {
                "Authorization": token,
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
            res = requests.post(url, headers=headers, json={"content": content}, timeout=15)
            
            if res.status_code in [200, 201, 204]:
                print(f"[{account_name}] [SUCCESS] #{channel_id}: {content[:30]}...")
                if account.get("useWebhook"):
                    send_webhook(account.get("webhookUrl"), account_name, channel_id, content, True, f"HTTP {res.status_code} OK")
                counter += 1
            else:
                print(f"[{account_name}] [FAILED {res.status_code}] #{channel_id}: {res.text[:100]}")
                if account.get("useWebhook"):
                    send_webhook(account.get("webhookUrl"), account_name, channel_id, content, False, f"HTTP {res.status_code}: {res.text[:80]}")
        except Exception as e:
            print(f"[{account_name}] [ERROR] #{channel_id}: {e}")
        
        time.sleep(interval)

def main():
    print("==================================================")
    print("    Discord Multi-Account Auto Poster Bot")
    print("==================================================")

    threads = []
    for account in CONFIG.get("accounts", []):
        if not account.get("token"):
            continue
        print(f"-> Initializing {account.get('name')}...")
        for ch in account.get("channels", []):
            if ch.get("channelId"):
                t = threading.Thread(target=post_channel_loop, args=(account, ch), daemon=True)
                t.start()
                threads.append(t)

    print(f"Running {len(threads)} posting thread(s). Press CTRL+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\\nBot terminated.")

if __name__ == "__main__":
    main()
`;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  // Security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Anti-bypass: never expose sensitive files (tokens, password hash, source) via Vite/static serving
  app.use((req: Request, res: Response, next: NextFunction) => {
    let decoded = req.path;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      return res.status(400).end();
    }
    if (BLOCKED_PATH_PATTERN.test(decoded.replace(/\\/g, '/'))) {
      return res.status(404).end();
    }
    next();
  });

  // Periodically purge expired sessions and stale login-attempt records
  setInterval(() => {
    const now = Date.now();
    for (const [t, s] of activeSessions) if (now > s.expiresAt) activeSessions.delete(t);
    for (const [ip, a] of loginAttempts) if (a.lockedUntil < now && a.count === 0) loginAttempts.delete(ip);
  }, 10 * 60 * 1000).unref();

  // Initialize config
  loadInitialConfig();

  // ==================== AUTHENTICATION API ====================
  // Public: Login endpoint with anti-brute-force rate limiting
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Check rate limit
    const attempt = loginAttempts.get(clientIp);
    if (attempt && attempt.lockedUntil > now) {
      const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Locked for ${waitSeconds} seconds.`,
      });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required.' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid input.' });
    }

    const authConfig = getAuthConfig();
    const hash = hashPassword(password, authConfig.salt);

    // Evaluate both comparisons (no short-circuit) to keep timing uniform
    const userOk = safeEqual(username, authConfig.username);
    const passOk = safeEqual(hash, authConfig.passwordHash);
    if (userOk && passOk) {
      // Clear failed attempts
      loginAttempts.delete(clientIp);

      // Generate secure session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      activeSessions.set(sessionToken, {
        username: authConfig.username,
        expiresAt: now + SESSION_TTL_MS, // 24 hours
      });

      return res.json({
        success: true,
        token: sessionToken,
        username: authConfig.username,
      });
    }

    // Record failed attempt
    const currentCount = (attempt?.count || 0) + 1;
    let lockedUntil = 0;
    if (currentCount >= 5) {
      lockedUntil = now + 45 * 1000; // Lock for 45s after 5 failed attempts
    }
    loginAttempts.set(clientIp, { count: currentCount, lockedUntil });

    return res.status(401).json({
      success: false,
      error: 'Invalid username or password.',
      remainingAttempts: Math.max(0, 5 - currentCount),
    });
  });

  // Verify current session
  app.get('/api/auth/check', (req: Request, res: Response) => {
    const found = getSessionFromRequest(req);
    if (!found) {
      return res.status(401).json({ authenticated: false, error: 'Session expired' });
    }
    return res.json({ authenticated: true, username: found.session.username });
  });

  // Logout session
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const found = getSessionFromRequest(req);
    if (found) activeSessions.delete(found.token);
    res.json({ success: true });
  });

  // Change password or username (requires authenticated session)
  app.post('/api/auth/change-credentials', requireAuth, (req: Request, res: Response) => {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'New password must be at least 4 characters.' });
    }

    const authConfig = getAuthConfig();
    const currHash = hashPassword(currentPassword, authConfig.salt);
    if (!safeEqual(currHash, authConfig.passwordHash)) {
      return res.status(403).json({ success: false, error: 'Current password incorrect.' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);

    const updatedConfig: AuthConfig = {
      username: (newUsername && newUsername.trim()) ? newUsername.trim() : authConfig.username,
      passwordHash: newHash,
      salt: newSalt,
    };

    saveAuthConfig(updatedConfig);

    // Invalidate all other sessions after credentials change (keep the current one)
    const current = getSessionFromRequest(req);
    for (const t of Array.from(activeSessions.keys())) {
      if (!current || t !== current.token) activeSessions.delete(t);
    }
    if (current) current.session.username = updatedConfig.username;

    res.json({ success: true, message: 'Credentials updated successfully.', username: updatedConfig.username });
  });

  // ==================== DASHBOARD API (PROTECTED) ====================
  app.get('/api/accounts', requireAuth, (req: Request, res: Response) => {
    res.json({
      accounts,
      updatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/accounts', requireAuth, (req: Request, res: Response) => {
    const { accounts: updatedAccounts } = req.body;
    if (Array.isArray(updatedAccounts)) {
      // Stop timers of accounts that were removed so they don't keep posting in the background
      const keepIds = new Set(updatedAccounts.map((a: AccountData) => a.id));
      for (const old of accounts) {
        if (!keepIds.has(old.id)) stopAccount(old.id);
      }
      accounts = updatedAccounts.map(newAcc => {
        const existing = accounts.find(a => a.id === newAcc.id);
        return {
          ...newAcc,
          isRunning: existing ? existing.isRunning : false,
          stats: existing ? existing.stats : (newAcc.stats || { sentCount: 0, failedCount: 0 }),
        };
      });
      saveConfigToDisk();
      return res.json({ success: true, count: accounts.length });
    }
    res.status(400).json({ error: 'Invalid accounts data' });
  });

  // Delete specific account endpoint
  app.delete('/api/accounts/:id', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    stopAccount(id);
    accounts = accounts.filter(a => a.id !== id);
    saveConfigToDisk();
    res.json({ success: true, accounts });
  });

  // Start specific account
  app.post('/api/accounts/:id/start', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const ok = startAccount(id);
    if (ok) {
      res.json({ success: true, message: `Account started successfully.` });
    } else {
      res.status(400).json({ success: false, error: 'Cannot start account. Please enter a valid Discord Token.' });
    }
  });

  // Stop specific account
  app.post('/api/accounts/:id/stop', requireAuth, (req: Request, res: Response) => {
    const { id } = req.params;
    const ok = stopAccount(id);
    if (ok) {
      res.json({ success: true, message: `Account stopped successfully.` });
    } else {
      res.status(400).json({ success: false, error: 'Failed to stop account.' });
    }
  });

  // Start all accounts
  app.post('/api/accounts/start-all', requireAuth, (req: Request, res: Response) => {
    let started = 0;
    for (const acc of accounts) {
      if (acc.token && acc.token.trim() !== '') {
        startAccount(acc.id);
        started++;
      }
    }
    res.json({ success: true, startedCount: started });
  });

  // Stop all accounts
  app.post('/api/accounts/stop-all', requireAuth, (req: Request, res: Response) => {
    for (const acc of accounts) {
      stopAccount(acc.id);
    }
    res.json({ success: true, stoppedCount: accounts.length });
  });

  // Validate Discord Token and fetch profile
  app.post('/api/discord/validate-token', requireAuth, async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is empty.' });
    }
    const profile = await fetchDiscordUserProfile(token);
    if (profile) {
      res.json({ success: true, profile });
    } else {
      res.status(401).json({ success: false, error: 'Invalid or expired Discord Token.' });
    }
  });

  // Test Discord Webhook
  app.post('/api/discord/test-webhook', requireAuth, async (req: Request, res: Response) => {
    const { webhookUrl, accountName } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: 'Invalid Webhook URL.' });
    }

    try {
      await sendDiscordWebhook(webhookUrl, {
        accountName: accountName || 'Test Account',
        usernameTag: '<@me>',
        channelId: 'TEST-CHANNEL-ID',
        messageText: 'Test message from Auto Poster!',
        statusMessage: 'Webhook test executed successfully!',
        success: true,
      });

      addLog({
        accountId: 'test',
        accountName: accountName || 'Webhook Test',
        channelId: 'webhook',
        success: true,
        message: 'Webhook test sent.',
        statusText: 'Webhook OK',
      });

      res.json({ success: true, message: 'Test webhook delivered successfully!' });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Single test send message to Discord channel
  app.post('/api/discord/send-test', requireAuth, async (req: Request, res: Response) => {
    const { token, channelId, message, accountName } = req.body;
    if (!token || !channelId) {
      return res.status(400).json({ success: false, error: 'Token and Channel ID are required.' });
    }

    const processedMsg = processMessageVariables(message || 'Test message');
    const result = await sendDiscordMessage(token, channelId, processedMsg);

    addLog({
      accountId: 'manual-test',
      accountName: accountName || 'Manual Test',
      channelId,
      success: result.success,
      message: processedMsg,
      statusText: result.text,
    });

    if (result.success) {
      res.json({ success: true, text: result.text });
    } else {
      res.status(result.status || 400).json({ success: false, text: result.text });
    }
  });

  // Logs endpoint
  app.get('/api/logs', requireAuth, (req: Request, res: Response) => {
    res.json({ logs });
  });

  app.delete('/api/logs', requireAuth, (req: Request, res: Response) => {
    logs = [];
    res.json({ success: true });
  });

  // Export standalone python script
  app.get('/api/export-python', requireAuth, (req: Request, res: Response) => {
    const script = generateMultiAccountPythonScript(accounts);
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', 'attachment; filename="autopost_multi.py"');
    res.send(script);
  });

  // Export config json
  app.get('/api/export-config', requireAuth, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="config_multi.json"');
    res.send(JSON.stringify({ accounts }, null, 2));
  });

  // Download entire project zip
  app.get('/api/download-project-zip', requireAuth, (req: Request, res: Response) => {
    const zipPath = path.join(__dirname, 'discord-multi-account-auto-poster.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="discord-multi-account-auto-poster.zip"');
      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);
    } else {
      res.status(404).json({ error: 'Zip file not found' });
    }
  });

  // Unknown API routes -> JSON 404 (never fall through to the SPA/Vite)
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Mount Vite middleware in dev or serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Auto Poster] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Auto Poster] Failed to start server:', err);
});
