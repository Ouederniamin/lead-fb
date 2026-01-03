import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';

// GET - List all accounts with session status
export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    // Determine status based on database fields
    const accountsWithStatus = accounts.map(account => {
      let status: string;
      const hasSession = account.sessionData !== null;
      
      // Use the new sessionStatus field if available
      if (account.isBanned || account.sessionStatus === 'BANNED') {
        status = 'banned';
      } else if (!account.email || !account.password) {
        status = 'not-configured';
      } else if (account.sessionStatus === 'NEEDS_PASSWORD' || account.sessionStatus === 'EXPIRED') {
        status = 'session-expired';
      } else if (hasSession && account.sessionStatus === 'ACTIVE') {
        status = 'logged-in';
      } else if (hasSession) {
        status = 'logged-in';
      } else {
        status = 'ready';
      }

      return {
        id: account.id,
        name: account.name || '',
        email: account.email,
        password: account.password ? '••••••••' : '',
        status,
        sessionStatus: account.sessionStatus,
        sessionError: account.sessionError,
        sessionValid: hasSession,
        lastLogin: account.lastLoginAt?.toISOString() || null,
        isBanned: account.isBanned,
        bannedReason: account.bannedReason,
        needsAttention: account.sessionStatus === 'NEEDS_PASSWORD' || 
                        account.sessionStatus === 'EXPIRED' ||
                        account.sessionStatus === 'BANNED',
      };
    });

    return NextResponse.json({ accounts: accountsWithStatus });
  } catch (error) {
    console.error('Error loading accounts:', error);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

// POST - Create new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.account.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        email,
        name: name || null,
        password: password || null,
      },
    });

    // Update worker .env file
    await updateWorkerEnv();

    return NextResponse.json({ 
      success: true, 
      account: { 
        id: account.id,
        name: account.name,
        email: account.email,
        password: account.password ? '••••••••' : '',
        status: account.password ? 'ready' : 'not-configured',
        sessionValid: false,
        lastLogin: null,
      }
    });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

// PUT - Update account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const existing = await prisma.account.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Build update data
    const updateData: { name?: string; email?: string; password?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined && password !== '••••••••') {
      updateData.password = password;
    }

    const account = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    // Update worker .env file
    await updateWorkerEnv();

    // Determine status from database fields
    let status: string;
    if (account.isBanned) {
      status = 'banned';
    } else if (!account.email || !account.password) {
      status = 'not-configured';
    } else if (account.sessionData !== null && account.lastLoginAt) {
      status = 'logged-in';
    } else {
      status = 'ready';
    }

    return NextResponse.json({ 
      success: true,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        password: '••••••••',
        status,
        sessionValid: account.sessionData !== null,
        lastLogin: account.lastLoginAt?.toISOString() || null,
      }
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

// DELETE - Remove account
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const existing = await prisma.account.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await prisma.account.delete({
      where: { id },
    });

    // Update worker .env file
    await updateWorkerEnv();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}

// Helper to update worker's .env ACCOUNTS_CONFIG
async function updateWorkerEnv() {
  const envPath = path.join(process.cwd(), 'worker', '.env');
  
  if (!fs.existsSync(envPath)) {
    return;
  }

  const accounts = await prisma.account.findMany({
    select: { id: true, email: true, name: true },
  });

  let envContent = fs.readFileSync(envPath, 'utf-8');
  
  // Create accounts config for worker
  const accountsConfig = accounts.map(a => ({
    id: a.id,
    email: a.email,
    name: a.name,
  }));

  const configLine = `ACCOUNTS_CONFIG=${JSON.stringify(accountsConfig)}`;
  
  // Replace or add ACCOUNTS_CONFIG line
  if (envContent.includes('ACCOUNTS_CONFIG=')) {
    envContent = envContent.replace(/ACCOUNTS_CONFIG=.*/g, configLine);
  } else {
    envContent += `\n${configLine}\n`;
  }

  fs.writeFileSync(envPath, envContent);
}
