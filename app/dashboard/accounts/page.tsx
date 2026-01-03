'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  LogIn, 
  RefreshCw, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Account {
  id: string;
  name: string;
  email: string;
  password: string;
  status: 'not-configured' | 'ready' | 'logged-in' | 'session-expired' | 'banned';
  lastLogin: string | null;
  sessionValid: boolean;
}

const statusConfig = {
  'not-configured': { 
    label: 'Not Configured', 
    variant: 'secondary' as const,
    icon: AlertCircle,
  },
  'ready': { 
    label: 'Ready', 
    variant: 'outline' as const,
    icon: Clock,
  },
  'logged-in': { 
    label: 'Logged In', 
    variant: 'default' as const,
    icon: CheckCircle,
  },
  'session-expired': { 
    label: 'Expired', 
    variant: 'destructive' as const,
    icon: XCircle,
  },
  'banned': { 
    label: 'Banned', 
    variant: 'destructive' as const,
    icon: XCircle,
  },
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginProgress, setLoginProgress] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    loadAccounts(true);
  }, []);

  async function loadAccounts(isInitial = false) {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const method = editingAccount ? 'PUT' : 'POST';
      const body = editingAccount 
        ? { id: editingAccount.id, ...formData }
        : formData;

      const res = await fetch('/api/accounts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingAccount(null);
        setFormData({ name: '', email: '', password: '' });
        loadAccounts(false);
        toast.success(editingAccount ? 'Account updated' : 'Account added');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save account');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save account');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!accountToDelete) return;

    try {
      const res = await fetch(`/api/accounts?id=${accountToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        loadAccounts(false);
        toast.success('Account deleted');
      } else {
        toast.error('Failed to delete account');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete account');
    } finally {
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    }
  }

  async function handleLogin(account: Account) {
    if (account.status === 'not-configured') {
      toast.error('Please configure email and password first');
      return;
    }

    if (loginProgress[account.id]) {
      toast.info('Login already in progress');
      return;
    }

    try {
      setLoginProgress(prev => ({ ...prev, [account.id]: true }));
      
      const res = await fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: account.id }),
      });

      const data = await res.json();
      
      if (res.ok) {
        if (data.alreadyRunning) {
          toast.info('Login already in progress. Check the browser window.');
        } else {
          toast.success('Browser opened! Complete any 2FA if needed.');
        }
        
        // Poll for login completion every 3 seconds for up to 5 minutes
        let attempts = 0;
        const maxAttempts = 100; // 5 minutes
        const pollInterval = setInterval(async () => {
          attempts++;
          
          try {
            const statusRes = await fetch('/api/accounts');
            const statusData = await statusRes.json();
            const updatedAccount = statusData.accounts?.find((a: Account) => a.id === account.id);
            
            if (updatedAccount && updatedAccount.status === 'logged-in') {
              clearInterval(pollInterval);
              setLoginProgress(prev => ({ ...prev, [account.id]: false }));
              setAccounts(statusData.accounts);
              toast.success(`${account.name || 'Account'} logged in successfully!`);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setLoginProgress(prev => ({ ...prev, [account.id]: false }));
              loadAccounts(false);
            }
          } catch {
            // Continue polling on error
          }
        }, 3000);
        
        // Cleanup after max time
        setTimeout(() => {
          clearInterval(pollInterval);
          setLoginProgress(prev => ({ ...prev, [account.id]: false }));
        }, 5 * 60 * 1000);
        
      } else {
        toast.error(data.error || 'Failed to start login');
        setLoginProgress(prev => ({ ...prev, [account.id]: false }));
      }
    } catch (error) {
      console.error('Failed to login:', error);
      toast.error('Failed to start login');
      setLoginProgress(prev => ({ ...prev, [account.id]: false }));
    }
  }

  function openEditModal(account: Account) {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      email: account.email,
      password: '',
    });
    setShowPassword(false);
    setShowModal(true);
  }

  function openAddModal() {
    setEditingAccount(null);
    setFormData({
      name: `Account ${accounts.length + 1}`,
      email: '',
      password: '',
    });
    setShowPassword(false);
    setShowModal(true);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  const stats = {
    total: accounts.length,
    loggedIn: accounts.filter(a => a.status === 'logged-in').length,
    ready: accounts.filter(a => a.status === 'ready').length,
    expired: accounts.filter(a => a.status === 'session-expired').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facebook Accounts</h1>
          <p className="text-muted-foreground">Manage your Facebook accounts for scraping</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAccounts(false)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAddModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Accounts</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Logged In</CardDescription>
            <CardTitle className="text-3xl text-green-500">{stats.loggedIn}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ready to Login</CardDescription>
            <CardTitle className="text-3xl text-yellow-500">{stats.ready}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Session Expired</CardDescription>
            <CardTitle className="text-3xl text-orange-500">{stats.expired}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Your Facebook accounts for lead scraping</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No accounts yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your Facebook accounts to start scraping leads
              </p>
              <Button className="mt-4" onClick={openAddModal}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => {
                const status = statusConfig[account.status];
                const StatusIcon = status.icon;
                const isLoggingIn = loginProgress[account.id];

                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <User className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{account.name}</span>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.email || 'No email configured'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last login: {formatDate(account.lastLogin)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={account.status === 'logged-in' ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleLogin(account)}
                            disabled={isLoggingIn || account.status === 'not-configured'}
                          >
                            {isLoggingIn ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Logging in...
                              </>
                            ) : (
                              <>
                                <LogIn className="mr-2 h-4 w-4" />
                                {account.status === 'logged-in' ? 'Re-login' : 'Login'}
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {account.status === 'not-configured' 
                            ? 'Configure email and password first' 
                            : 'Open browser to login'}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(account)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAccountToDelete(account);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-blue-400">💡 How to use</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Add your aged Facebook accounts with email and password</li>
            <li>Click &quot;Login&quot; to open a browser and authenticate</li>
            <li>Complete any 2FA or verification in the browser</li>
            <li>The session will be saved automatically</li>
            <li>Once logged in, the account will show &quot;Logged In&quot; status</li>
          </ol>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount 
                ? 'Update the account details below' 
                : 'Enter the Facebook account credentials'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Account 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email / Phone</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Facebook email or phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={editingAccount ? 'Leave blank to keep current' : 'Facebook password'}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAccount ? 'Save Changes' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{accountToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}