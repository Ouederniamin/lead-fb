import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');

interface AISettings {
  systemPrompt: string;
  responseTemplates: string[];
  whatsappNumber: string;
  autoEngage: boolean;
  minIntentScoreForComment: number;
  minIntentScoreForDM: number;
}

const defaultAISettings: AISettings = {
  systemPrompt: `Sei un assistente AI specializzato nell'analisi di lead per servizi di contabilità e business in Italia.`,
  responseTemplates: [],
  whatsappNumber: '+39 XXX XXX XXXX',
  autoEngage: false,
  minIntentScoreForComment: 4,
  minIntentScoreForDM: 5,
};

async function loadSettings(): Promise<{ ai: AISettings }> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { ai: defaultAISettings };
  }
}

// GET /api/settings/ai - specifically for the worker
export async function GET() {
  const settings = await loadSettings();
  return NextResponse.json(settings.ai);
}
