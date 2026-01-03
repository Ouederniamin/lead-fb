/**
 * API client for Control Plane communication
 */

import config from '../config.js';
import logger from '../utils/logger.js';

interface Group {
  id: string;
  url: string;
  name: string;
  priority: number;
  isActive: boolean;
  assignedAccountId?: string;
}

interface AISettings {
  systemPrompt: string;
  responseTemplates: string[];
  whatsappNumber: string;
}

interface LeadData {
  groupId: string;
  postUrl: string;
  authorName?: string;
  authorProfileUrl?: string;
  authorFbId?: string;
  postText: string;
  postDate?: string;
  aiAnalysis?: unknown;
  intentScore?: number;
  scrapedById?: string;
}

interface AnalyzeRequest {
  postText: string;
  authorName?: string;
  groupName?: string;
}

class APIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.controlPlaneUrl;
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error ${response.status}: ${error}`);
    }

    return response.json();
  }

  // ==================== Groups ====================

  async getGroups(): Promise<Group[]> {
    try {
      const groups = await this.request<Group[]>('/api/groups');
      return groups.filter(g => g.isActive);
    } catch (error) {
      logger.error('API', 'Failed to fetch groups', error);
      return [];
    }
  }

  async getGroupsForAccount(accountId: string): Promise<Group[]> {
    const allGroups = await this.getGroups();
    // Filter groups assigned to this account, or unassigned groups
    return allGroups.filter(
      g => !g.assignedAccountId || g.assignedAccountId === accountId
    );
  }

  // ==================== Leads ====================

  async submitLead(lead: LeadData): Promise<{ id: string } | null> {
    try {
      const result = await this.request<{ id: string }>('/api/leads', {
        method: 'POST',
        body: JSON.stringify(lead),
      });
      logger.info('API', `Lead submitted: ${result.id}`);
      return result;
    } catch (error) {
      // 409 = duplicate, not an error
      if (String(error).includes('409')) {
        logger.debug('API', 'Lead already exists, skipping');
        return null;
      }
      logger.error('API', 'Failed to submit lead', error);
      return null;
    }
  }

  // ==================== AI ====================

  async analyzePost(data: AnalyzeRequest): Promise<unknown> {
    try {
      const result = await this.request('/api/ai/analyze', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result;
    } catch (error) {
      logger.error('API', 'Failed to analyze post', error);
      return null;
    }
  }

  async getAISettings(): Promise<AISettings | null> {
    try {
      const result = await this.request<AISettings>('/api/settings/ai');
      return result;
    } catch (error) {
      logger.debug('API', 'AI settings not found, using defaults');
      return null;
    }
  }

  // ==================== Heartbeat ====================

  async sendHeartbeat(
    agentId: string,
    status: string,
    stats: { dailyComments?: number; dailyDms?: number; dailyScrapes?: number },
    error?: string
  ): Promise<void> {
    try {
      await this.request('/api/agents/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          status,
          ...stats,
          error,
        }),
      });
    } catch (err) {
      logger.error('API', 'Failed to send heartbeat', err);
    }
  }
}

export const api = new APIClient();
export default api;
