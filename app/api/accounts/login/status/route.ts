import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST - Update account login status and save session (called by login script)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, success, sessionData } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    if (success) {
      await prisma.account.update({
        where: { id: accountId },
        data: {
          isLoggedIn: true,
          lastLoginAt: new Date(),
          loginError: null,
          sessionData: sessionData || null,  // Store Playwright storage state as JSON
          // Reset session status to ACTIVE on successful login
          sessionStatus: "ACTIVE",
          sessionError: null,
          sessionExpiredAt: null,
        },
      });
      
      // Dismiss any existing session-related notifications for this account
      await prisma.notification.updateMany({
        where: {
          accountId,
          type: { in: ["SESSION_EXPIRED", "SESSION_NEEDS_LOGIN"] },
          isDismissed: false,
        },
        data: { isDismissed: true },
      });
      
      console.log(`✅ Account ${accountId} logged in and session saved to database`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating account status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
