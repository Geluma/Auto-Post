import React from 'react';
import {
  Play,
  Square,
  Plus,
  Save,
  Terminal,
  Activity,
  Radio,
  FileJson,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { AccountData } from '../types';

interface HeaderProps {
  accounts: AccountData[];
  onAddAccount: () => void;
  onStartAll: () => void;
  onStopAll: () => void;
  onSaveAll: () => void;
  isSaving: boolean;
  autoSaveStatus?: 'saved' | 'saving' | 'unsaved';
  onOpenLogs: () => void;
  onOpenBackupModal: () => void;
  onOpenPythonScriptModal: () => void;
  onOpenSettingsModal: () => void;
  onLogout: () => void;
  logsCount: number;
  currentUsername: string;
}

export const Header: React.FC<HeaderProps> = ({
  accounts,
  onAddAccount,
  onStartAll,
  onStopAll,
  onSaveAll,
  isSaving,
  autoSaveStatus,
  onOpenLogs,
  onOpenBackupModal,
  onOpenPythonScriptModal,
  onOpenSettingsModal,
  onLogout,
  logsCount,
  currentUsername,
}) => {
  const runningCount = accounts.filter((a) => a.isRunning).length;
  const totalSent = accounts.reduce((acc, a) => acc + (a.stats?.sentCount || 0), 0);

  return (
    <header className="bg-[#1e1f22] sticky top-0 z-30 border-b border-[#313338] px-4 lg:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Compact Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#5865f2] flex items-center justify-center text-white shadow-md shadow-[#5865f2]/20 shrink-0">
            <Radio className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-white tracking-tight">Auto Poster</h1>

            {/* Compact pill indicators */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="bg-[#2b2d31] px-2 py-0.5 rounded-md border border-[#383a40]">
                {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
              </span>

              <span
                className={`px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1 ${
                  runningCount > 0
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                    : 'bg-[#2b2d31] text-gray-400 border-[#383a40]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    runningCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                  }`}
                />
                {runningCount} Active
              </span>

              <span className="hidden sm:inline text-gray-400 text-xs">
                Sent: <strong className="text-gray-200">{totalSent}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Add Account */}
          <button
            onClick={onAddAccount}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#5865f2] hover:bg-[#4752c4] text-white shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>

          {/* Start All */}
          <button
            onClick={onStartAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Start all configured accounts"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>Start All</span>
          </button>

          {/* Stop All */}
          <button
            onClick={onStopAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Stop all accounts"
          >
            <Square className="w-3 h-3 fill-white" />
            <span>Stop All</span>
          </button>

          {/* Save Config */}
          <div className="flex items-center gap-1.5">
            {autoSaveStatus && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-gray-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    autoSaveStatus === 'saving'
                      ? 'bg-amber-400 animate-ping'
                      : autoSaveStatus === 'unsaved'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="text-[10px]">
                  {autoSaveStatus === 'saving'
                    ? 'Saving...'
                    : autoSaveStatus === 'unsaved'
                    ? 'Unsaved'
                    : 'Auto-saved'}
                </span>
              </span>
            )}
            <button
              onClick={onSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#2b2d31] hover:bg-[#35373c] text-gray-200 border border-[#3f4147] transition-all cursor-pointer"
              title="Save all configurations to disk"
            >
              <Save className={`w-3 h-3 ${isSaving ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSaving ? 'Saving' : 'Save All'}</span>
            </button>
          </div>

          {/* Logs */}
          <button
            onClick={onOpenLogs}
            className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#2b2d31] hover:bg-[#35373c] text-gray-200 border border-[#3f4147] transition-all cursor-pointer"
            title="Activity Logs"
          >
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>Logs</span>
            {logsCount > 0 && (
              <span className="bg-[#5865f2] text-white text-[9px] px-1 rounded-full font-bold">
                {logsCount}
              </span>
            )}
          </button>

          {/* JSON Config */}
          <button
            onClick={onOpenBackupModal}
            className="p-1.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-gray-300 border border-[#3f4147] transition-all cursor-pointer"
            title="Import / Export JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
          </button>

          {/* Python Termux / Windows */}
          <button
            onClick={onOpenPythonScriptModal}
            className="p-1.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-gray-300 border border-[#3f4147] transition-all cursor-pointer"
            title="Termux & PC Python Script"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
          </button>

          {/* Password & Security */}
          <button
            onClick={onOpenSettingsModal}
            className="p-1.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-gray-300 border border-[#3f4147] transition-all cursor-pointer"
            title={`Password Settings (${currentUsername})`}
          >
            <KeyRound className="w-3.5 h-3.5 text-gray-300" />
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg bg-[#2b2d31] hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 border border-[#3f4147] transition-all cursor-pointer"
            title="Lock & Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
