import { z } from 'zod'

// Schema for AI lead analysis output
export const LeadAnalysisSchema = z.object({
  needType: z.string().describe('Type of service needed (e.g., web development, app, design, e-commerce)'),
  urgency: z.number().min(1).max(5).describe('Urgency level: 1=low, 2=moderate, 3=medium, 4=high, 5=very urgent'),
  budgetMentioned: z.boolean().describe('Whether a budget was mentioned in the post'),
  budgetRange: z.string().optional().describe('Budget range if mentioned (e.g., "1000-5000€")'),
  keyRequirements: z.array(z.string()).describe('List of specific requirements mentioned'),
  sentiment: z.enum(['casual', 'interested', 'urgent', 'desperate']).describe('Overall sentiment of the post'),
  language: z.string().describe('Language of the post'),
  intentScore: z.number().min(1).max(5).describe('Overall lead quality: 1=not a lead, 5=very high intent'),
  suggestedResponse: z.string().describe('Natural Italian response with WhatsApp mention'),
  isLead: z.boolean().describe('Whether this post represents a potential lead'),
})

export type LeadAnalysis = z.infer<typeof LeadAnalysisSchema>

// Schema for creating a new lead
export const CreateLeadSchema = z.object({
  groupId: z.string(),
  postUrl: z.string().url(),
  authorName: z.string().optional(),
  authorProfileUrl: z.string().optional(),
  authorFbId: z.string().optional(),
  postText: z.string(),
  postDate: z.string().datetime().optional(),
})

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>

// Schema for creating a new group
export const CreateGroupSchema = z.object({
  url: z.string().url(),
  name: z.string(),
  description: z.string().optional(),
  memberCount: z.number().optional(),
  isActive: z.boolean().optional().default(true),
  assignedAccountId: z.string().optional().transform(val => val === '' ? undefined : val),
})

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>

// Schema for agent heartbeat
export const AgentHeartbeatSchema = z.object({
  agentId: z.string(),
  status: z.enum(['ONLINE', 'SCRAPING', 'ENGAGING', 'COOLING_DOWN', 'RATE_LIMITED']),
  dailyComments: z.number().optional(),
  dailyDms: z.number().optional(),
  dailyScrapes: z.number().optional(),
  currentAction: z.string().optional(),
  error: z.string().optional(),
})

export type AgentHeartbeatInput = z.infer<typeof AgentHeartbeatSchema>

// Schema for updating lead status
export const UpdateLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'COMMENTED', 'DM_SENT', 'RESPONDED', 'CONVERTED', 'ARCHIVED']).optional(),
  stage: z.enum(['LEAD', 'INTERESTED', 'CTA_WHATSAPP', 'CTA_PHONE', 'CONVERTED', 'LOST']).optional(),
  contactInfo: z.string().optional(),
  commentText: z.string().optional(),
  dmText: z.string().optional(),
  accountId: z.string().optional(), // Required when creating conversation
})

export type UpdateLeadStatusInput = z.infer<typeof UpdateLeadStatusSchema>
