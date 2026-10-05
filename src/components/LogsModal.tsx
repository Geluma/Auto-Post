import React, { useState } from 'react';
import {
  X,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Hash,
  Clock,
  Filter,
} from 'lucide-react';
import { LogEntry } from '../types';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  onClearLogs: () => void;
  onRefreshLogs: () => void;
  isRefreshing: boolean;
}

export const LogsModal: React.FC<LogsModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  onRefreshLogs,
  isRefreshing,
}) => {
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');

  if (!isOpen) return null;

  const accountNames = Array.from(new Set(logs.map((l) => l.accountName))).filter(Boolean);

  const filteredLogs = logs.filter((log) => {
    if (filterAccount !== 'all' && log.accountName !== filterAccount) return false;
    if (filterStatus === 'success' && !log.success) return false;
    if (filterStatus === 'failed' && log.success) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383a40] flex items-center justify-between bg-[#1e1f22]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Activity Logs ({logs.length})
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefreshLogs}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClearLogs}
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Clear Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-2.5 bg-[#232428] border-b border-[#383a40] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="bg-[#2b2d31] text-gray-200 border border-[#3f4147] rounded-lg px-2 py-1 text-xs focus:outline-none"
            >
              <option value="all">All Accounts</option>
              {accountNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-[#5865f2] text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('success')}
              className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                filterStatus === 'success'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                filterStatus === 'failed'
                  ? 'bg-rose-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-10 text-gray-500 font-sans text-xs">
              No logs recorded yet.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-colors ${
                  log.success
                    ? 'bg-[#1e1f22]/50 border-emerald-900/30'
                    : 'bg-[#1e1f22]/50 border-rose-900/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                        log.success
                          ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-800/40'
                          : 'text-rose-400 bg-rose-950/80 border border-rose-800/40'
                      }`}
                    >
                      {log.success ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                      {log.success ? 'Success' : 'Failed'}
                    </span>

                    <span className="font-semibold text-gray-200">[{log.accountName}]</span>

                    {log.channelId && log.channelId !== '-' && (
                      <span className="text-gray-400 flex items-center gap-0.5">
                        <Hash className="w-2.5 h-2.5" />
                        {log.channelId}
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-gray-500 flex items-center gap-1 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {log.timestamp}
                  </div>
                </div>

                <div className="text-gray-300 font-sans text-[11px] bg-[#232428] px-2 py-1.5 rounded border border-[#313338] break-words">
                  {log.message}
                </div>

                <div className="text-[10px] text-gray-400">
                  Status: <span className={log.success ? 'text-emerald-400' : 'text-rose-400 font-medium'}>{log.statusText}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
