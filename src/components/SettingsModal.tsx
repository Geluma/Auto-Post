import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  currentUsername: string;
  onCredentialsUpdated: (newUsername: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  token,
  currentUsername,
  onCredentialsUpdated,
}) => {
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setStatus({ success: false, message: 'Please enter current and new password.' });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch('/api/auth/change-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newUsername,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus({ success: true, message: 'Password updated successfully!' });
        onCredentialsUpdated(data.username || newUsername);
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => {
          onClose();
          setStatus(null);
        }, 1200);
      } else {
        setStatus({ success: false, message: data.error || 'Failed to update credentials.' });
      }
    } catch (err: any) {
      setStatus({ success: false, message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#383a40] flex items-center justify-between bg-[#1e1f22]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#5865f2]" />
            <h2 className="text-sm font-bold text-white tracking-wide">Security Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#35373c] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {status && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                status.success
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
              }`}
            >
              {status.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-gray-300 block mb-1">Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full bg-[#1e1f22] text-xs text-gray-100 px-3 py-2 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-300 block mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1e1f22] text-xs text-gray-100 px-3 py-2 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-300 block mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#1e1f22] text-xs text-gray-100 px-3 py-2 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-[#1e1f22] hover:bg-[#35373c] text-gray-300 rounded-lg text-xs font-medium border border-[#3f4147] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
