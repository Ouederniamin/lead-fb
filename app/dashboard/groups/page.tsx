'use client';

import { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  Plus,
  ExternalLink,
  Trash2,
  Edit,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  FileText,
  UserCircle,
  Database,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Account {
  id: string;
  email: string;
  name: string | null;
  status: string;
  sessionValid: boolean;
}

interface Group {
  id: string;
  name: string;
  url: string;
  fbGroupId: string | null;
  description: string | null;
  memberCount: number | null;
  isActive: boolean;
  // Initialization
  isInitialized: boolean;
  initializedAt: string | null;
  // Scraping
  lastScrapedAt: string | null;
  lastScrapedPostId: string | null;
  // Stats
  totalPosts: number;
  totalLeads: number;
  leadsCount: number;
  postsCount: number;
  // Assignment
  assignedAccountId: string | null;
  assignedAccount: Account | null;
  // Dates
  createdAt: string;
}

export default function GroupsPage() {
  const [showModal, setShowModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [groupToReset, setGroupToReset] = useState<Group | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    isActive: true,
    assignedAccountId: '',
  });

  useEffect(() => {
    fetchGroups();
    fetchAccounts();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/groups');
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch {
      console.error('Failed to load accounts');
    }
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      const url = editingGroup ? `/api/groups/${editingGroup.id}` : '/api/groups';
      const method = editingGroup ? 'PUT' : 'POST';
      
      // Build payload, omitting assignedAccountId if empty
      const payload: Record<string, unknown> = {
        url: formData.url,
        name: formData.name,
        description: formData.description,
        memberCount: formData.memberCount,
        isActive: formData.isActive,
      };
      if (formData.assignedAccountId) {
        payload.assignedAccountId = formData.assignedAccountId;
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchGroups();
        closeModal();
        toast.success(editingGroup ? 'Group updated' : 'Group added');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save group');
      }
    } catch {
      toast.error('Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!groupToDelete) return;

    try {
      const response = await fetch(`/api/groups/${groupToDelete.id}`, { method: 'DELETE' });
      if (response.ok) {
        setGroups(groups.filter(g => g.id !== groupToDelete.id));
        toast.success('Group deleted');
      } else {
        toast.error('Failed to delete group');
      }
    } catch {
      toast.error('Failed to delete group');
    } finally {
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  const handleReset = async () => {
    if (!groupToReset) return;
    
    setResetting(true);
    try {
      const response = await fetch(`/api/groups/${groupToReset.id}/reset`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update the group in the list
        setGroups(groups.map(g => 
          g.id === groupToReset.id ? { ...g, ...data.group } : g
        ));
        toast.success(data.message || 'Group reset successfully');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to reset group');
      }
    } catch {
      toast.error('Failed to reset group');
    } finally {
      setResetting(false);
      setResetDialogOpen(false);
      setGroupToReset(null);
    }
  };

  const toggleActive = async (group: Group) => {
    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...group,
          isActive: !group.isActive 
        }),
      });
      
      if (response.ok) {
        setGroups(groups.map(g => 
          g.id === group.id ? { ...g, isActive: !g.isActive } : g
        ));
        toast.success(group.isActive ? 'Group paused' : 'Group activated');
      }
    } catch {
      toast.error('Failed to update group');
    }
  };

  const openEditModal = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      url: group.url,
      isActive: group.isActive,
      assignedAccountId: group.assignedAccountId || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingGroup(null);
    setFormData({ name: '', url: '', isActive: true, assignedAccountId: '' });
  };

  const stats = {
    total: groups.length,
    initialized: groups.filter(g => g.isInitialized).length,
    notInitialized: groups.filter(g => !g.isInitialized).length,
    active: groups.filter(g => g.isActive).length,
    withAccount: groups.filter(g => g.assignedAccountId).length,
    totalLeads: groups.reduce((sum, g) => sum + (g.leadsCount || 0), 0),
    totalPosts: groups.reduce((sum, g) => sum + (g.postsCount || 0), 0),
  };

  const getInitBadge = (group: Group) => {
    if (group.isInitialized) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Initialized
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {group.initializedAt 
              ? `Initialized ${formatDistanceToNow(new Date(group.initializedAt), { addSuffix: true })}`
              : 'Initialized'
            }
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Badge variant="outline" className="text-orange-400 border-orange-500/50 gap-1">
        <XCircle className="w-3 h-3" />
        Not Init
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Target Groups</h1>
          <p className="text-muted-foreground">Manage Facebook groups for lead generation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchGroups} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Group
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border p-4 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Groups</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.total}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-700">
              <FolderKanban className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border p-4 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/60 dark:to-green-950 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400">Initialized</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.initialized}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-green-200 dark:bg-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border p-4 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/60 dark:to-orange-950 border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Needs Init</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.notInitialized}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-200 dark:bg-orange-800">
              <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border p-4 bg-gradient-to-br from-violet-100 to-violet-50 dark:from-violet-900/60 dark:to-violet-950 border-violet-200 dark:border-violet-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400">With Account</p>
              <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{stats.withAccount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-200 dark:bg-violet-800">
              <UserCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/60 dark:to-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Posts</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.totalPosts}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-200 dark:bg-blue-800">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border p-4 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/60 dark:to-purple-950 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Total Leads</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.totalLeads}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-200 dark:bg-purple-800">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Groups Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Groups
          </CardTitle>
          <CardDescription>Facebook groups you&apos;re monitoring for leads</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && groups.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No groups yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first Facebook group to start scraping leads
              </p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Group
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Init Status</TableHead>
                  <TableHead>Assigned Account</TableHead>
                  <TableHead>Posts / Leads</TableHead>
                  <TableHead>Last Scraped</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id} className={!group.isInitialized ? 'bg-orange-500/5' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <a 
                          href={group.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          View Group <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>{getInitBadge(group)}</TableCell>
                    <TableCell>
                      {group.assignedAccount ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${group.assignedAccount.status === 'logged-in' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <span className="text-sm">
                            {group.assignedAccount.name || group.assignedAccount.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-blue-400 font-medium">{group.postsCount}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-purple-400 font-medium">{group.leadsCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {group.lastScrapedAt ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(group.lastScrapedAt), { addSuffix: true })}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {new Date(group.lastScrapedAt).toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={group.isActive ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleActive(group)}
                      >
                        {group.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {group.isInitialized && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setGroupToReset(group);
                                  setResetDialogOpen(true);
                                }}
                              >
                                <RotateCcw className="h-4 w-4 text-orange-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reset Initialization</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(group)}>
                              <Edit className="h-4 w-4" />
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
                                setGroupToDelete(group);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Group' : 'Add New Group'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup 
                ? 'Update the group details below' 
                : 'Add a Facebook group to monitor for leads'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">Group URL *</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://facebook.com/groups/example"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Freelancers Tunisia"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account">
                  <div className="flex items-center gap-1">
                    <UserCircle className="w-4 h-4" />
                    Assigned Account
                  </div>
                </Label>
                <Select 
                  value={formData.assignedAccountId || 'none'} 
                  onValueChange={(v) => setFormData({ ...formData, assignedAccountId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">No account assigned</span>
                    </SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${acc.status === 'logged-in' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {acc.name || acc.email}
                          {acc.status === 'banned' && <Badge variant="destructive" className="text-xs">Banned</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Account used for Initiator &amp; Message agents on this group
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Scrape this group for leads
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            {editingGroup && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Group Stats
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Initialized:</span>{' '}
                    <span className={editingGroup.isInitialized ? 'text-green-600' : 'text-orange-600'}>
                      {editingGroup.isInitialized ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Posts:</span>{' '}
                    <span className="font-medium">{editingGroup.postsCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Leads:</span>{' '}
                    <span className="font-medium">{editingGroup.leadsCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Scraped:</span>{' '}
                    <span className="font-medium">
                      {editingGroup.lastScrapedAt 
                        ? formatDistanceToNow(new Date(editingGroup.lastScrapedAt), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name || !formData.url || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGroup ? 'Save Changes' : 'Add Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{groupToDelete?.name}&quot;? This will also remove all associated leads and posts.
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

      {/* Reset Confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              Reset Group Initialization
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to reset <strong>&quot;{groupToReset?.name}&quot;</strong>?
                </p>
                <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm">
                  <p className="font-medium text-orange-400 mb-2">This will permanently delete:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>{groupToReset?.postsCount || 0}</strong> scraped posts</li>
                    <li><strong>{groupToReset?.leadsCount || 0}</strong> leads from this group</li>
                    <li>All initialization and scraping progress</li>
                  </ul>
                </div>
                <p className="text-muted-foreground">
                  The group will need to be re-initialized to start scraping again.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={resetting}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset Group
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
