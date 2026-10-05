import React, { useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Hash,
  Webhook,
  Plus,
  RefreshCw,
  User,
  X,
  Save,
  Check,
} from 'lucide-react';
import { AccountData, ChannelItem } from '../types';

interface AccountCardProps {
  account: AccountData;
  index: number;
  authToken: string;
  onUpdate: (updated: AccountData) => void;
  onDelete: (id: string) => void;
  onDuplicate: (account: AccountData) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onSave?: (account: AccountData) => Promise<void> | void;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  index,
  authToken,
  onUpdate,
  onDelete,
  onDuplicate,
  onStart,
  onStop,
  onSave,
}) => {
  const [showToken, setShowToken] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testWebhookStatus, setTestWebhookStatus] = useState<string | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [testChannelStatus, setTestChannelStatus] = useState<{ id: string; msg: string; success: boolean } | null>(null);
  const [isCardSaving, setIsCardSaving] = useState(false);
  const [savedRecently, setSavedRecently] = useState(false);

  // Validate token
  const handleValidateToken = async () => {
    if (!account.token) {
      setTokenStatus({ success: false, message: 'Please enter a Discord token.' });
      return;
    }
    setIsValidatingToken(true);
    setTokenStatus(null);
    try {
      const res = await fetch('/api/discord/validate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: account.token }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.profile) {
        const updatedAcc = {
          ...account,
          userProfile: data.profile,
          name: account.name === `Account ${index + 1}` ? `@${data.profile.username}` : account.name,
        };
        onUpdate(updatedAcc);
        if (onSave) {
          onSave(updatedAcc);
        }
        setTokenStatus({ success: true, message: `Connected as @${data.profile.username}` });
      } else {
        setTokenStatus({ success: false, message: data.error || 'Invalid token.' });
      }
    } catch (err: any) {
      setTokenStatus({ success: false, message: `Error: ${err.message}` });
    } finally {
      setIsValidatingToken(false);
    }
  };

  // Webhook Test
  const handleTestWebhook = async () => {
    if (!account.webhookUrl) {
      setTestWebhookStatus('Please enter a Webhook URL first.');
      return;
    }
    setIsTestingWebhook(true);
    setTestWebhookStatus(null);
    try {
      const res = await fetch('/api/discord/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          webhookUrl: account.webhookUrl,
          accountName: account.name,
        }),
      });
      const data = await res.json();
      setTestWebhookStatus(data.success ? 'Success! Webhook delivered.' : `Failed: ${data.error}`);
    } catch (err: any) {
      setTestWebhookStatus(`Error: ${err.message}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Test single channel send
  const handleTestChannelPost = async (channel: ChannelItem) => {
    if (!account.token || !channel.channelId) {
      setTestChannelStatus({
        id: channel.id,
        msg: 'Token and Channel ID are required.',
        success: false,
      });
      return;
    }

    setTestingChannelId(channel.id);
    setTestChannelStatus(null);
    try {
      const res = await fetch('/api/discord/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: account.token,
          channelId: channel.channelId,
          message: channel.message,
          accountName: account.name,
        }),
      });
      const data = await res.json();
      setTestChannelStatus({
        id: channel.id,
        msg: data.text || (data.success ? 'Sent successfully' : 'Failed to send'),
        success: !!data.success,
      });
    } catch (err: any) {
      setTestChannelStatus({
        id: channel.id,
        msg: `Error: ${err.message}`,
        success: false,
      });
    } finally {
      setTestingChannelId(null);
    }
  };

  // Channel Operations
  const handleAddChannel = () => {
    const newChannel: ChannelItem = {
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      channelId: '',
      channelName: `Channel #${account.channels.length + 1}`,
      message: '',
      hours: 0,
      minutes: 2,
      seconds: 0,
      interval: 120,
      enabled: true,
    };
    onUpdate({
      ...account,
      channels: [...account.channels, newChannel],
    });
  };

  const handleUpdateChannel = (channelId: string, updates: Partial<ChannelItem>) => {
    const updatedChannels = account.channels.map((ch) => {
      if (ch.id === channelId) {
        const merged = { ...ch, ...updates };
        if (updates.hours !== undefined || updates.minutes !== undefined || updates.seconds !== undefined) {
          const h = updates.hours !== undefined ? updates.hours : ch.hours;
          const m = updates.minutes !== undefined ? updates.minutes : ch.minutes;
          const s = updates.seconds !== undefined ? updates.seconds : ch.seconds;
          merged.interval = h * 3600 + m * 60 + s;
        }
        return merged;
      }
      return ch;
    });
    onUpdate({
      ...account,
      channels: updatedChannels,
    });
  };

  const handleRemoveChannel = (channelId: string) => {
    if (account.channels.length <= 1) {
      onUpdate({
        ...account,
        channels: [
          {
            ...account.channels[0],
            channelId: '',
            message: '',
          },
        ],
      });
      return;
    }
    onUpdate({
      ...account,
      channels: account.channels.filter((ch) => ch.id !== channelId),
    });
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col bg-[#2b2d31] shadow-lg ${
        account.isRunning
          ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
          : 'border-[#383a40] hover:border-[#43464d]'
      }`}
    >
      {/* Card Header */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${
          account.isRunning
            ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'
            : 'bg-[#1e1f22] border-[#383a40] text-gray-400'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar / Icon */}
          <div className="relative shrink-0">
            {account.userProfile?.avatarUrl ? (
              <img
                src={account.userProfile.avatarUrl}
                alt={account.name}
                className="w-8 h-8 rounded-full ring-1 ring-[#5865f2] object-cover bg-[#1e1f22]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#35373c] text-gray-300 flex items-center justify-center font-semibold text-xs">
                {account.name.slice(0, 2).toUpperCase() || `A${index + 1}`}
              </div>
            )}
            {account.isRunning && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#2b2d31]" />
            )}
          </div>

          {/* Account Name & Status */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={account.name}
                onChange={(e) => onUpdate({ ...account, name: e.target.value })}
                className="font-medium text-white text-sm bg-transparent border-b border-transparent hover:border-gray-600 focus:border-[#5865f2] focus:outline-none px-1 rounded truncate max-w-[160px] sm:max-w-[200px]"
                placeholder="Account Name"
              />
              {account.userProfile && (
                <span className="text-[10px] text-indigo-300 bg-[#5865f2]/10 border border-[#5865f2]/20 px-1.5 py-0.5 rounded font-mono truncate max-w-[100px]">
                  @{account.userProfile.username}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  account.isRunning ? 'bg-emerald-400' : 'bg-gray-500'
                }`}
              />
              <span className={account.isRunning ? 'text-emerald-400 font-medium' : 'text-gray-400'}>
                {account.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {account.isRunning ? (
            <button
              onClick={() => onStop(account.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-white" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={() => onStart(account.id)}
              disabled={!account.token}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${
                account.token
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  : 'bg-gray-700/60 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-3 h-3 fill-white" />
              <span>Start</span>
            </button>
          )}

          <button
            onClick={async () => {
              if (onSave) {
                setIsCardSaving(true);
                await onSave(account);
                setIsCardSaving(false);
                setSavedRecently(true);
                setTimeout(() => setSavedRecently(false), 2000);
              }
            }}
            disabled={isCardSaving}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              savedRecently
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-[#35373c] hover:bg-[#404249] text-gray-200 border border-[#4e5058]/40'
            }`}
            title="Save this account settings"
          >
            {savedRecently ? (
              <>
                <Check className="w-3 h-3 text-white" />
                <span className="text-[11px]">Saved</span>
              </>
            ) : (
              <>
                <Save className={`w-3 h-3 ${isCardSaving ? 'animate-spin' : ''}`} />
                <span className="text-[11px]">{isCardSaving ? 'Saving' : 'Save'}</span>
              </>
            )}
          </button>

          <button
            onClick={() => onDuplicate(account)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {isConfirmingDelete ? (
            <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded-lg text-xs animate-in fade-in duration-150">
              <span className="text-rose-300 text-[11px] font-medium">Delete?</span>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmingDelete(false);
                  onDelete(account.id);
                }}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded cursor-pointer transition-colors shadow-sm"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                className="px-2 py-0.5 bg-[#35373c] hover:bg-[#404249] text-gray-300 text-[11px] rounded cursor-pointer transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Delete account"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-4 flex-1">
        {/* Token Section */}
        <div className="bg-[#1e1f22] p-3 rounded-xl border border-[#383a40] space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
              Discord Token
            </label>
            <button
              onClick={handleValidateToken}
              disabled={isValidatingToken || !account.token}
              className="text-[11px] text-[#5865f2] hover:text-[#7983f5] font-medium flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isValidatingToken ? 'animate-spin' : ''}`} />
              <span>{isValidatingToken ? 'Checking...' : 'Check'}</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <input
              type={showToken ? 'text' : 'password'}
              value={account.token}
              onChange={(e) => onUpdate({ ...account, token: e.target.value })}
              placeholder="Paste token here..."
              className="w-full bg-[#2b2d31] text-gray-100 text-xs px-3 py-2 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none pr-9 font-mono placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2.5 text-gray-400 hover:text-white p-0.5 cursor-pointer"
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {tokenStatus && (
            <div
              className={`text-[11px] p-2 rounded-lg flex items-center gap-1.5 ${
                tokenStatus.success
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
              }`}
            >
              {tokenStatus.success ? (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">{tokenStatus.message}</span>
            </div>
          )}
        </div>

        {/* Channels Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
              Target Channels ({account.channels.length})
            </label>
            <button
              onClick={handleAddChannel}
              className="text-[11px] bg-[#35373c] hover:bg-[#404249] text-gray-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium transition-colors cursor-pointer border border-[#4e5058]/40"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>

          {account.channels.map((channel, cIdx) => (
            <div
              key={channel.id}
              className="bg-[#1e1f22] p-3 rounded-xl border border-[#383a40] space-y-2.5"
            >
              {/* Channel ID + Test row */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-[#2b2d31] rounded-lg border border-[#3f4147] px-2.5 focus-within:border-[#5865f2]">
                  <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1.5" />
                  <input
                    type="text"
                    value={channel.channelId}
                    onChange={(e) => handleUpdateChannel(channel.id, { channelId: e.target.value.trim() })}
                    placeholder="Channel ID (e.g. 1314961955584344116)"
                    className="w-full bg-transparent text-gray-100 text-xs py-1.5 focus:outline-none font-mono placeholder:text-gray-500"
                  />
                </div>

                <button
                  onClick={() => handleTestChannelPost(channel)}
                  disabled={testingChannelId === channel.id || !account.token || !channel.channelId}
                  className="px-2.5 py-1.5 bg-[#35373c] hover:bg-[#404249] text-gray-200 text-xs rounded-lg font-medium flex items-center gap-1 border border-[#4e5058]/40 disabled:opacity-40 cursor-pointer shrink-0 transition-colors"
                  title="Send 1 test message"
                >
                  <Send className={`w-3 h-3 ${testingChannelId === channel.id ? 'animate-spin' : ''}`} />
                  <span>Test</span>
                </button>

                <button
                  onClick={() => handleRemoveChannel(channel.id)}
                  className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title={account.channels.length > 1 ? 'Delete channel' : 'Clear channel'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {testChannelStatus && testChannelStatus.id === channel.id && (
                <div
                  className={`text-[11px] p-2 rounded-lg flex items-center gap-1.5 ${
                    testChannelStatus.success
                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                      : 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                  }`}
                >
                  {testChannelStatus.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{testChannelStatus.msg}</span>
                </div>
              )}

              {/* Message Input with Clear Button */}
              <div className="relative">
                <textarea
                  rows={2}
                  value={channel.message}
                  onChange={(e) => handleUpdateChannel(channel.id, { message: e.target.value })}
                  placeholder="Enter auto post message... (leave empty or type text)"
                  className="w-full bg-[#2b2d31] text-gray-100 text-xs p-2.5 pr-8 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none resize-y placeholder:text-gray-500 font-mono"
                />
                {channel.message && (
                  <button
                    type="button"
                    onClick={() => handleUpdateChannel(channel.id, { message: '' })}
                    className="absolute right-2 top-2 p-1 text-gray-400 hover:text-white rounded hover:bg-[#35373c] transition-colors cursor-pointer"
                    title="Clear text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Interval Row */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  Interval:
                </span>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={channel.hours || 0}
                      onChange={(e) =>
                        handleUpdateChannel(channel.id, { hours: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="w-11 bg-[#2b2d31] text-gray-100 text-xs py-1 rounded border border-[#3f4147] text-center font-mono focus:outline-none focus:border-[#5865f2]"
                    />
                    <span className="text-[10px] text-gray-500">h</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={channel.minutes || 0}
                      onChange={(e) =>
                        handleUpdateChannel(channel.id, { minutes: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="w-11 bg-[#2b2d31] text-gray-100 text-xs py-1 rounded border border-[#3f4147] text-center font-mono focus:outline-none focus:border-[#5865f2]"
                    />
                    <span className="text-[10px] text-gray-500">m</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={channel.seconds || 0}
                      onChange={(e) =>
                        handleUpdateChannel(channel.id, { seconds: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="w-11 bg-[#2b2d31] text-gray-100 text-xs py-1 rounded border border-[#3f4147] text-center font-mono focus:outline-none focus:border-[#5865f2]"
                    />
                    <span className="text-[10px] text-gray-500">s</span>
                  </div>

                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/30 ml-1">
                    {channel.interval || 0}s
                  </span>

                  {account.isRunning && channel.nextPostAt && channel.nextPostAt > Date.now() && (
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/40 ml-1">
                      Next: {Math.max(1, Math.ceil((channel.nextPostAt - Date.now()) / 1000))}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Webhook Section */}
        <div className="bg-[#1e1f22] p-3 rounded-xl border border-[#383a40] space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={account.useWebhook}
                onChange={(e) => onUpdate({ ...account, useWebhook: e.target.checked })}
                className="rounded border-gray-600 text-[#5865f2] focus:ring-[#5865f2] w-3.5 h-3.5 bg-[#2b2d31]"
              />
              <Webhook className="w-3 h-3 text-indigo-400" />
              Discord Webhook
            </label>

            {account.useWebhook && (
              <button
                onClick={handleTestWebhook}
                disabled={isTestingWebhook || !account.webhookUrl}
                className="text-[11px] bg-[#35373c] hover:bg-[#404249] text-gray-200 px-2 py-0.5 rounded border border-[#4e5058]/40 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <Send className={`w-2.5 h-2.5 ${isTestingWebhook ? 'animate-spin' : ''}`} />
                Test
              </button>
            )}
          </div>

          {account.useWebhook && (
            <input
              type="text"
              value={account.webhookUrl}
              onChange={(e) => onUpdate({ ...account, webhookUrl: e.target.value.trim() })}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-[#2b2d31] text-gray-100 text-xs px-2.5 py-1.5 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none font-mono"
            />
          )}

          {testWebhookStatus && (
            <div className="text-[11px] p-1.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
              {testWebhookStatus}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Metrics & Status */}
      <div className="px-4 py-2.5 bg-[#1e1f22] border-t border-[#383a40] flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3 text-[11px]">
          <span>
            Sent: <strong className="text-emerald-400">{account.stats?.sentCount || 0}</strong>
          </span>
          <span>
            Failed: <strong className="text-rose-400">{account.stats?.failedCount || 0}</strong>
          </span>
        </div>

        {account.stats?.lastStatusMessage && (
          <div
            className={`text-[11px] truncate max-w-[200px] ${
              account.stats.lastSuccess ? 'text-emerald-400' : 'text-rose-400'
            }`}
            title={account.stats.lastStatusMessage}
          >
            {account.stats.lastStatusMessage}
          </div>
        )}
      </div>
    </div>
  );
};
