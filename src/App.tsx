import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AccountData, LogEntry } from './types';
import { Header } from './components/Header';
import { AccountCard } from './components/AccountCard';
import { LogsModal } from './components/LogsModal';
import { BackupModal } from './components/BackupModal';
import { PythonScriptModal } from './components/PythonScriptModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginScreen } from './components/LoginScreen';
import { Plus, Search, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('autopost_token'));
  const [username, setUsername] = useState<string>('admin');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const accountsRef = useRef<AccountData[]>([]);
  accountsRef.current = accounts;

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Modals
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Verify token on initial load
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('autopost_token');
      if (!storedToken) {
        setIsCheckingAuth(false);
        setIsAuthenticated(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/check', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const data = await res.json();
        if (res.ok && data.authenticated) {
          setToken(storedToken);
          setUsername(data.username || 'admin');
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('autopost_token');
          setToken(null);
          setIsAuthenticated(false);
        }
      } catch {
        localStorage.removeItem('autopost_token');
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore
      }
    }
    localStorage.removeItem('autopost_token');
    setToken(null);
    setIsAuthenticated(false);
  };

  // Perform Save to backend (saves to disk via /api/accounts)
  const performSave = async (accountsToSave?: AccountData[], showToastNotification: boolean = false) => {
    const dataToSave = accountsToSave || accountsRef.current;
    if (!token || dataToSave.length === 0) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setIsSaving(true);
    setAutoSaveStatus('saving');
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accounts: dataToSave }),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        setAutoSaveStatus('saved');
        if (showToastNotification) {
          showToast('Configuration saved successfully!', 'success');
        }
      } else {
        const err = await res.json();
        showToast(err.error || 'Server error saving accounts', 'error');
        setAutoSaveStatus('unsaved');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setAutoSaveStatus('unsaved');
    } finally {
      setIsSaving(false);
    }
  };

  // Manual save for button
  const saveAllAccounts = async (accountsToSave?: AccountData[]) => {
    await performSave(accountsToSave, true);
  };

  // Fetch accounts (Smart merge to avoid clobbering user inputs during polling)
  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.accounts)) {
          setAccounts((prev) => {
            // If local state is empty, initialize directly from server
            if (prev.length === 0) {
              accountsRef.current = data.accounts;
              return data.accounts;
            }

            const serverMap = new Map<string, AccountData>(data.accounts.map((a: AccountData) => [a.id, a]));

            // Non-destructively merge server execution status & stats without wiping user input fields!
            const merged = prev.map((localAcc) => {
              const serverAcc = serverMap.get(localAcc.id);
              if (!serverAcc) return localAcc;

              return {
                ...localAcc,
                isRunning: serverAcc.isRunning,
                stats: serverAcc.stats || localAcc.stats,
                userProfile: localAcc.userProfile || serverAcc.userProfile,
                channels: localAcc.channels.map((localCh) => {
                  const serverCh = (serverAcc.channels || []).find((c: any) => c.id === localCh.id);
                  if (!serverCh) return localCh;
                  return {
                    ...localCh,
                    lastPostedAt: serverCh.lastPostedAt ?? localCh.lastPostedAt,
                    nextPostAt: serverCh.nextPostAt ?? localCh.nextPostAt,
                  };
                }),
              };
            });

            accountsRef.current = merged;
            return merged;
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!token) return;
    try {
      setIsRefreshingLogs(true);
      const res = await fetch('/api/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setIsRefreshingLogs(false);
    }
  }, [token]);

  // Handle Login success
  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    localStorage.setItem('autopost_token', newToken);
    setToken(newToken);
    setUsername(newUsername);
    setIsAuthenticated(true);
  };

  // Initial dashboard load & polling
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    setIsLoading(true);
    fetchAccounts();
    fetchLogs();

    const interval = setInterval(() => {
      fetchLogs();
      fetchAccounts();
    }, 4000);

    return () => clearInterval(interval);
  }, [isAuthenticated, token, fetchAccounts, fetchLogs]);

  // Start specific account
  const handleStartAccount = async (id: string) => {
    if (!token) return;
    await performSave(undefined, false);

    try {
      const res = await fetch(`/api/accounts/${id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === id ? { ...acc, isRunning: true } : acc))
        );
        fetchLogs();
        showToast('Account started', 'success');
      } else {
        showToast(data.error || 'Failed to start account.', 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Stop specific account
  const handleStopAccount = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/accounts/${id}/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        setAccounts((prev) =>
          prev.map((acc) => (acc.id === id ? { ...acc, isRunning: false } : acc))
        );
        fetchLogs();
        showToast('Account stopped', 'success');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Start all
  const handleStartAll = async () => {
    if (!token) return;
    await saveAllAccounts();
    try {
      const res = await fetch('/api/accounts/start-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        fetchAccounts();
        fetchLogs();
        showToast('All accounts started', 'success');
      } else {
        showToast(data.error || 'Failed to start all accounts.', 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Stop all
  const handleStopAll = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/accounts/stop-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) {
        fetchAccounts();
        fetchLogs();
        showToast('All accounts stopped', 'success');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Add account card
  const handleAddAccount = () => {
    const newId = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newAccount: AccountData = {
      id: newId,
      name: `Account ${accounts.length + 1}`,
      token: '',
      useWebhook: false,
      webhookUrl: '',
      isRunning: false,
      channels: [
        {
          id: `ch_${Date.now()}_1`,
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
      stats: {
        sentCount: 0,
        failedCount: 0,
      },
    };

    const nextAccounts = [...accounts, newAccount];
    setAccounts(nextAccounts);
    saveAllAccounts(nextAccounts);
    showToast('New account added', 'success');
  };

  // Duplicate account
  const handleDuplicateAccount = (acc: AccountData) => {
    const newId = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const clonedChannels = acc.channels.map((ch, idx) => ({
      ...ch,
      id: `ch_${Date.now()}_${idx}`,
      lastPostedAt: undefined,
      nextPostAt: undefined,
    }));

    const duplicated: AccountData = {
      ...acc,
      id: newId,
      name: `${acc.name} (Copy)`,
      isRunning: false,
      channels: clonedChannels,
      stats: {
        sentCount: 0,
        failedCount: 0,
      },
    };

    const nextAccounts = [...accounts, duplicated];
    setAccounts(nextAccounts);
    saveAllAccounts(nextAccounts);
    showToast(`Duplicated "${acc.name}"`, 'success');
  };

  // Delete account
  const handleDeleteAccount = async (id: string) => {
    const target = accounts.find((a) => a.id === id);
    const targetName = target?.name || 'Account';

    // 1. Immediately remove from local UI state
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    showToast(`"${targetName}" removed`, 'success');

    // 2. Call server to stop timer & remove from stored config
    if (token) {
      try {
        const res = await fetch(`/api/accounts/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.accounts)) {
            setAccounts(data.accounts);
          }
        }
      } catch (err) {
        console.error('Failed to delete account on server:', err);
      }
    }
  };

  // Update account card in state + trigger auto-save debounce
  const handleUpdateAccount = (updated: AccountData, immediate: boolean = false) => {
    setAccounts((prev) => {
      const next = prev.map((a) => (a.id === updated.id ? updated : a));
      accountsRef.current = next;

      if (immediate) {
        performSave(next, true);
      } else {
        setAutoSaveStatus('unsaved');
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
          performSave(next, false);
        }, 800);
      }

      return next;
    });
  };

  // Save specific account card directly
  const handleSaveSingleAccount = async (account: AccountData) => {
    const currentAccounts = accountsRef.current.map((a) => (a.id === account.id ? account : a));
    setAccounts(currentAccounts);
    accountsRef.current = currentAccounts;
    await performSave(currentAccounts, true);
  };

  // Clear logs
  const handleClearLogs = async () => {
    if (!token) return;
    try {
      await fetch('/api/logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    if (filterActiveOnly && !acc.isRunning) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      acc.name.toLowerCase().includes(q) ||
      acc.userProfile?.username.toLowerCase().includes(q) ||
      acc.channels.some((c) => c.channelId.includes(q))
    );
  });

  // Auth checking loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#5865f2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated -> Anti-Bypass Login Screen
  if (!isAuthenticated || !token) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#1e1f22] text-gray-100 flex flex-col font-sans antialiased selection:bg-[#5865f2] selection:text-white">
      {/* Clean Minimalist Header */}
      <Header
        accounts={accounts}
        onAddAccount={handleAddAccount}
        onStartAll={handleStartAll}
        onStopAll={handleStopAll}
        onSaveAll={() => saveAllAccounts()}
        isSaving={isSaving}
        autoSaveStatus={autoSaveStatus}
        onOpenLogs={() => setIsLogsModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenPythonScriptModal={() => setIsPythonModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onLogout={handleLogout}
        logsCount={logs.length}
        currentUsername={username}
      />

      {/* Main Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-6 py-5 space-y-4">
        {/* Minimal Search & Filter Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search accounts or channels..."
              className="w-full bg-[#2b2d31] text-xs text-gray-200 pl-8 pr-3 py-1.5 rounded-lg border border-[#3f4147] focus:border-[#5865f2] focus:outline-none placeholder:text-gray-500"
            />
          </div>

          <button
            onClick={() => setFilterActiveOnly(!filterActiveOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
              filterActiveOnly
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-[#2b2d31] text-gray-400 hover:text-white border-[#3f4147]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                filterActiveOnly ? 'bg-white' : 'bg-emerald-400'
              }`}
            />
            <span>Running Only</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-6 h-6 text-[#5865f2] animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Loading accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-4 text-center bg-[#2b2d31] rounded-2xl border border-[#383a40] space-y-3 max-w-md mx-auto shadow-md">
            <div className="w-12 h-12 rounded-xl bg-[#5865f2]/10 border border-[#5865f2]/20 flex items-center justify-center text-[#5865f2] mx-auto">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">No Accounts Configured</h3>
              <p className="text-xs text-gray-400 mt-1">Add your first Discord account card to start.</p>
            </div>
            <button
              onClick={handleAddAccount}
              className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
          </div>
        ) : (
          /* Clean Minimalist Account Cards Grid */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {filteredAccounts.map((account, index) => (
              <AccountCard
                key={account.id}
                account={account}
                index={index}
                authToken={token}
                onUpdate={handleUpdateAccount}
                onDelete={handleDeleteAccount}
                onDuplicate={handleDuplicateAccount}
                onStart={handleStartAccount}
                onStop={handleStopAccount}
                onSave={handleSaveSingleAccount}
              />
            ))}
          </div>
        )}
      </main>

      {/* Activity Logs Modal */}
      <LogsModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        logs={logs}
        onClearLogs={handleClearLogs}
        onRefreshLogs={fetchLogs}
        isRefreshing={isRefreshingLogs}
      />

      {/* Config JSON Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        accounts={accounts}
        authToken={token}
        onImport={(imported) => {
          setAccounts(imported);
          saveAllAccounts(imported);
        }}
      />

      {/* Python Script Modal */}
      <PythonScriptModal
        isOpen={isPythonModalOpen}
        onClose={() => setIsPythonModalOpen(false)}
        accounts={accounts}
        authToken={token}
      />

      {/* Settings / Password Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        token={token}
        currentUsername={username}
        onCredentialsUpdated={(newU) => setUsername(newU)}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-bottom-2 duration-200 text-xs font-medium bg-[#2b2d31] text-white border-[#3f4147]">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
