import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AccountConfig {
  id: string;
  email: string;
  name: string;
}

// Parse accounts from environment
function parseAccounts(): AccountConfig[] {
  try {
    const accountsJson = process.env.ACCOUNTS_CONFIG || '[]';
    return JSON.parse(accountsJson);
  } catch {
    console.error('Failed to parse ACCOUNTS_CONFIG');
    return [];
  }
}

export const config = {
  // Control Plane
  controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://localhost:3000',
  apiKey: process.env.API_KEY || '',

  // Accounts
  accounts: parseAccounts(),

  // Paths
  sessionsDir: path.join(__dirname, '..', 'sessions'),
  
  // Timezone
  timezone: process.env.TIMEZONE || 'Africa/Tunis',

  // Browser
  headless: process.env.HEADLESS === 'true',
  slowMo: parseInt(process.env.SLOW_MO || '50'),

  // Scheduling
  peakHours: [12, 13, 19, 20, 21], // 2 runs per hour
  operatingHours: { start: 8, end: 24 }, // 08:00 - 00:00

  // Safety limits per account per day
  limits: {
    maxScrapes: 25,
    maxComments: 15,
    maxDms: 8,
    maxGroupsPerCycle: 5,
  },

  // Delays (ms)
  delays: {
    betweenActions: { min: 2000, max: 5000 },
    betweenScrolls: { min: 1000, max: 3000 },
    beforeClick: { min: 500, max: 1500 },
    typingSpeed: { min: 50, max: 150 },
    jitterBeforeStart: { min: 60000, max: 300000 }, // 1-5 min
    sessionWarmup: { min: 30000, max: 60000 }, // 30-60 sec
  },
};

export default config;
