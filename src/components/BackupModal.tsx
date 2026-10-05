import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Archive,
} from 'lucide-react';
import { AccountData } from '../types';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountData[];
  authToken?: string | null;
  onImport: (importedAccounts: AccountData[]) => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  accounts,
  authToken,
  onImport,
}) => {
  const [jsonInput, setJsonInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentConfigJson = JSON.stringify({ accounts }, null, 2);

  const handleDownloadJson = () => {
    const blob = new Blob([currentConfigJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config_multi_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    try {
      const activeToken = authToken || localStorage.getItem('autopost_token');
      const res = await fetch('/api/download-project-zip', {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      if (!res.ok) throw new Error('Failed to download zip');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'discord-multi-account-auto-poster.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Error downloading ZIP: ' + e.message);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentConfigJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonInput(content);
        processJson(content);
      } catch (err: any) {
        setImportStatus({ success: false, message: `Failed to read file: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  const processJson = (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText);

      // Case 1: Multi-account format { accounts: [...] }
      if (Array.isArray(parsed.accounts)) {
        onImport(parsed.accounts);
        setImportStatus({
          success: true,
          message: `Imported ${parsed.accounts.length} account(s).`,
        });
        return;
      }

      // Case 2: Direct array of accounts [ {...}, {...} ]
      if (Array.isArray(parsed)) {
        onImport(parsed);
        setImportStatus({
          success: true,
          message: `Imported ${parsed.length} account(s).`,
        });
        return;
      }

      // Case 3: Old single-account config.json
      if (parsed.token !== undefined) {
        const channels = (parsed.channels || []).map((ch: any, idx: number) => {
          const interval = ch.interval || 60;
          return {
            id: `ch_${Date.now()}_${idx}`,
            channelId: ch.id || '',
            channelName: `Channel #${idx + 1}`,
            message: ch.message || '',
            hours: Math.floor(interval / 3600),
            minutes: Math.floor((interval % 3600) / 60),
            seconds: interval % 60,
            interval,
            enabled: true,
          };
        });

        const migrated: AccountData[] = [
          {
            id: `acc_${Date.now()}_migrated`,
            name: 'Account 1',
            token: parsed.token || '',
            useWebhook: !!parsed.use_webhook,
            webhookUrl: parsed.webhook_url || '',
            channels: channels.length > 0 ? channels : [
              {
                id: `ch_${Date.now()}_1`,
                channelId: '',
                channelName: 'Channel #1',
                message: 'Hello!',
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

        onImport(migrated);
        setImportStatus({
          success: true,
          message: 'Config imported successfully.',
        });
        return;
      }

      setImportStatus({
        success: false,
        message: 'Unrecognized JSON format.',
      });
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: `JSON parse error: ${err.message}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383a40] flex items-center justify-between bg-[#1e1f22]">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white tracking-wide">
              Configuration JSON
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-gray-300">
          {/* Export */}
          <div className="bg-[#1e1f22] p-3.5 rounded-xl border border-[#383a40] space-y-2.5">
            <h3 className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Export Configuration
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadJson}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
              <button
                onClick={handleCopyJson}
                className="px-3 py-1.5 bg-[#35373c] hover:bg-[#404249] text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-[#4e5058]/50 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownloadZip}
                className="px-3 py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                title="Download full project code (.zip)"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Download Project ZIP</span>
              </button>
            </div>
          </div>

          {/* Import */}
          <div className="bg-[#1e1f22] p-3.5 rounded-xl border border-[#383a40] space-y-2.5">
            <h3 className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Import Configuration
            </h3>

            <div className="space-y-2">
              <label className="flex items-center justify-center p-2.5 border border-dashed border-[#4e5058] rounded-lg hover:border-[#5865f2] bg-[#2b2d31]/50 cursor-pointer transition-colors text-gray-300">
                <span className="flex items-center gap-1.5 text-xs">
                  <Upload className="w-3.5 h-3.5 text-gray-400" />
                  Upload .json file
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <textarea
                rows={3}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Or paste JSON code here..."
                className="w-full bg-[#2b2d31] text-gray-100 text-xs p-2.5 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none font-mono"
              />

              <button
                onClick={() => processJson(jsonInput)}
                disabled={!jsonInput.trim()}
                className="w-full py-2 bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Apply Import</span>
              </button>
            </div>

            {importStatus && (
              <div
                className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${
                  importStatus.success
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                    : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                }`}
              >
                {importStatus.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{importStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
