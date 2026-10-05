import React, { useState } from 'react';
import {
  X,
  Terminal,
  Download,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { AccountData } from '../types';

interface PythonScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountData[];
  authToken: string;
}

export const PythonScriptModal: React.FC<PythonScriptModalProps> = ({
  isOpen,
  onClose,
  accounts,
  authToken,
}) => {
  const [activeTab, setActiveTab] = useState<'termux' | 'windows'>('termux');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadPython = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch('/api/export-python', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'autopost_multi.py';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setDownloadError('Failed to download script. Please check your session.');
      }
    } catch (err: any) {
      setDownloadError(`Error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const sampleCommandTermux = `pkg install python git -y
pip install requests
python autopost_multi.py`;

  const sampleCommandWindows = `pip install requests
python autopost_multi.py`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383a40] flex items-center justify-between bg-[#1e1f22]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Run on Termux / Windows
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-gray-300">
          {downloadError && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/50 text-xs">
              {downloadError}
            </div>
          )}
          <div className="bg-[#1e1f22] p-3.5 rounded-xl border border-[#383a40] flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Standalone Multi-Account Script</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Pre-configured for your {accounts.length} account(s).
              </p>
            </div>
            <button
              onClick={handleDownloadPython}
              disabled={isDownloading}
              className="px-3 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Downloading...' : 'Download .py'}</span>
            </button>
          </div>

          {/* Platform Tabs */}
          <div className="flex items-center gap-2 border-b border-[#383a40] pb-2 text-xs">
            <button
              onClick={() => setActiveTab('termux')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'termux'
                  ? 'bg-[#5865f2] text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Termux (Android)</span>
            </button>
            <button
              onClick={() => setActiveTab('windows')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === 'windows'
                  ? 'bg-[#5865f2] text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Windows (PC)</span>
            </button>
          </div>

          {activeTab === 'termux' && (
            <div className="space-y-2 bg-[#1e1f22] p-3 rounded-xl border border-[#383a40]">
              <p className="text-gray-300 text-[11px]">Run these commands in Termux:</p>
              <pre className="bg-[#232428] p-2.5 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto border border-[#383a40]">
                {sampleCommandTermux}
              </pre>
            </div>
          )}

          {activeTab === 'windows' && (
            <div className="space-y-2 bg-[#1e1f22] p-3 rounded-xl border border-[#383a40]">
              <p className="text-gray-300 text-[11px]">Run in CMD or PowerShell:</p>
              <pre className="bg-[#232428] p-2.5 rounded-lg text-emerald-400 font-mono text-[11px] overflow-x-auto border border-[#383a40]">
                {sampleCommandWindows}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
