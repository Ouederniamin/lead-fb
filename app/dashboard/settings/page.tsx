'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Bot, 
  Users, 
  MessageSquare, 
  Phone,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface AISettings {
  systemPrompt: string;
  responseTemplates: string[];
  whatsappNumber: string;
  autoEngage: boolean;
  minIntentScoreForComment: number;
  minIntentScoreForDM: number;
}

interface AccountConfig {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}

interface SettingsData {
  ai: AISettings;
  accounts: AccountConfig[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTemplate, setNewTemplate] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      
      if (response.ok) {
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateAI = (field: keyof AISettings, value: unknown) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ai: { ...settings.ai, [field]: value },
    });
  };

  const addTemplate = () => {
    if (!settings || !newTemplate.trim()) return;
    setSettings({
      ...settings,
      ai: {
        ...settings.ai,
        responseTemplates: [...settings.ai.responseTemplates, newTemplate.trim()],
      },
    });
    setNewTemplate('');
  };

  const removeTemplate = (index: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ai: {
        ...settings.ai,
        responseTemplates: settings.ai.responseTemplates.filter((_, i) => i !== index),
      },
    });
  };

  const updateAccount = (index: number, field: keyof AccountConfig, value: unknown) => {
    if (!settings) return;
    const newAccounts = [...settings.accounts];
    newAccounts[index] = { ...newAccounts[index], [field]: value };
    setSettings({ ...settings, accounts: newAccounts });
  };

  const addAccount = () => {
    if (!settings) return;
    const newId = `account-${settings.accounts.length + 1}`;
    setSettings({
      ...settings,
      accounts: [
        ...settings.accounts,
        { id: newId, email: '', name: `Account ${settings.accounts.length + 1}`, isActive: true },
      ],
    });
  };

  const removeAccount = (index: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      accounts: settings.accounts.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <CardTitle className="mb-2">Failed to Load Settings</CardTitle>
          <CardDescription className="mb-4">
            There was an error loading your settings.
          </CardDescription>
          <Button onClick={fetchSettings}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure AI behavior and accounts
            </p>
          </div>
          
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ai">
          <TabsList>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Configuration
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Facebook Accounts
            </TabsTrigger>
          </TabsList>

          {/* AI Configuration Tab */}
          <TabsContent value="ai" className="mt-6 space-y-6">
            {/* System Prompt */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-500" />
                  System Prompt
                </CardTitle>
                <CardDescription>
                  This prompt tells the AI how to analyze posts and generate responses.
                  Write in the language you want the AI to respond in.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={settings.ai.systemPrompt}
                  onChange={(e) => updateAI('systemPrompt', e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  placeholder="Enter your system prompt..."
                />
              </CardContent>
            </Card>

            {/* WhatsApp Number */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="h-5 w-5 text-green-500" />
                  WhatsApp Number
                </CardTitle>
                <CardDescription>
                  This number will be included in AI-generated responses. Use format: +39 XXX XXX XXXX
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="text"
                  value={settings.ai.whatsappNumber}
                  onChange={(e) => updateAI('whatsappNumber', e.target.value)}
                  className="max-w-xs"
                  placeholder="+39 XXX XXX XXXX"
                />
              </CardContent>
            </Card>

            {/* Response Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Response Templates
                </CardTitle>
                <CardDescription>
                  Templates for quick responses. Use {'{whatsapp}'} for your number and {'{name}'} for the lead&apos;s name.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {settings.ai.responseTemplates.map((template, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="text"
                        value={template}
                        onChange={(e) => {
                          const newTemplates = [...settings.ai.responseTemplates];
                          newTemplates[index] = e.target.value;
                          updateAI('responseTemplates', newTemplates);
                        }}
                        className="flex-1"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTemplate(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove template</TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
                    className="flex-1"
                    placeholder="Add new template..."
                  />
                  <Button onClick={addTemplate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Engagement Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Engagement Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-engage with leads</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically comment on high-intent posts
                    </p>
                  </div>
                  <Switch
                    checked={settings.ai.autoEngage}
                    onCheckedChange={(checked) => updateAI('autoEngage', checked)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Score for Comment</Label>
                    <Select
                      value={String(settings.ai.minIntentScoreForComment)}
                      onValueChange={(value) => updateAI('minIntentScoreForComment', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min Score for DM</Label>
                    <Select
                      value={String(settings.ai.minIntentScoreForDM)}
                      onValueChange={(value) => updateAI('minIntentScoreForDM', parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Facebook Accounts</CardTitle>
                    <CardDescription>
                      Configure the accounts used by the worker. After saving, copy the config to your worker&apos;s .env file.
                    </CardDescription>
                  </div>
                  <Button onClick={addAccount}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.accounts.map((account, index) => (
                  <div 
                    key={account.id}
                    className={`p-4 border rounded-lg ${
                      account.isActive 
                        ? 'border-green-500/50 bg-green-500/5' 
                        : 'border-border bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Account ID</Label>
                          <Input
                            type="text"
                            value={account.id}
                            onChange={(e) => updateAccount(index, 'id', e.target.value)}
                            placeholder="account-1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Display Name</Label>
                          <Input
                            type="text"
                            value={account.name}
                            onChange={(e) => updateAccount(index, 'name', e.target.value)}
                            placeholder="Account 1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Email (for reference)</Label>
                          <Input
                            type="email"
                            value={account.email}
                            onChange={(e) => updateAccount(index, 'email', e.target.value)}
                            placeholder="account@example.com"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={account.isActive}
                            onCheckedChange={(checked) => updateAccount(index, 'isActive', checked)}
                          />
                          <Badge variant={account.isActive ? "default" : "secondary"}>
                            {account.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAccount(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove account</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Worker Config Output */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy this to your worker/.env file:
                  </p>
                  <pre className="text-xs text-primary overflow-x-auto font-mono">
                    ACCOUNTS_CONFIG={JSON.stringify(settings.accounts.filter(a => a.isActive))}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Instructions */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  How to use accounts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside text-sm space-y-2 text-muted-foreground">
                  <li>Add your Facebook account details above</li>
                  <li>Save changes and copy the ACCOUNTS_CONFIG to your worker/.env file</li>
                  <li>In the worker folder, run: <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs">npm run login:all</code></li>
                  <li>Log in to each account in the browser that opens</li>
                  <li>Sessions are saved and will be reused automatically</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
