import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Settings file path (we'll store settings in a JSON file since Prisma doesn't have a Settings model yet)
const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

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

interface Settings {
  ai: AISettings;
  accounts: AccountConfig[];
}

const defaultSettings: Settings = {
  ai: {
    systemPrompt: `Sei un assistente AI specializzato nell'analisi di lead per servizi di contabilità e business in Italia.

Analizza ogni post per identificare:
1. Richieste di commercialista o contabile
2. Domande su apertura partita IVA
3. Problemi fiscali o contabili
4. Nuove attività che cercano supporto
5. Freelancer che cercano gestione fiscale

Rispondi sempre in italiano, in modo amichevole e professionale.
Quando suggerisci una risposta, includi sempre il numero WhatsApp per contatto diretto.`,
    responseTemplates: [
      "Ciao! Ho visto il tuo post e penso di poterti aiutare. Contattami su WhatsApp: {whatsapp}",
      "Ciao {name}! Sono un commercialista e mi occupo proprio di questo. Se vuoi possiamo parlarne su WhatsApp: {whatsapp}",
      "Buongiorno! Ho esperienza in questo campo e posso darti una mano. Scrivimi su WhatsApp se ti fa comodo: {whatsapp}",
    ],
    whatsappNumber: '+39 XXX XXX XXXX',
    autoEngage: false,
    minIntentScoreForComment: 4,
    minIntentScoreForDM: 5,
  },
  accounts: [
    { id: 'account-1', email: 'account1@example.com', name: 'Account 1', isActive: true },
    { id: 'account-2', email: 'account2@example.com', name: 'Account 2', isActive: true },
    { id: 'account-3', email: 'account3@example.com', name: 'Account 3', isActive: true },
    { id: 'account-4', email: 'account4@example.com', name: 'Account 4', isActive: true },
  ],
};

async function ensureSettingsDir() {
  const dir = path.dirname(SETTINGS_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

async function loadSettings(): Promise<Settings> {
  try {
    await ensureSettingsDir();
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return { ...defaultSettings, ...JSON.parse(data) };
  } catch {
    return defaultSettings;
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  await ensureSettingsDir();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET /api/settings
export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json(settings);
}

// PUT /api/settings
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const currentSettings = await loadSettings();
    
    const newSettings: Settings = {
      ai: { ...currentSettings.ai, ...body.ai },
      accounts: body.accounts || currentSettings.accounts,
    };
    
    await saveSettings(newSettings);
    
    return NextResponse.json(newSettings);
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
