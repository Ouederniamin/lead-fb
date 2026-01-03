// Cron job endpoint for cleaning up old posts
// Schedule: Run daily at 3 AM
// 
// For Vercel: Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/cleanup-posts",
//     "schedule": "0 3 * * *"
//   }]
// }

import { NextRequest, NextResponse } from "next/server";
import { cleanupOldPosts, getPostStats } from "@/lib/cleanup-posts";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get("authorization");
  
  // In production, require the cron secret
  if (process.env.NODE_ENV === "production" && CRON_SECRET) {
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }
  
  try {
    console.log("🧹 Starting scheduled post cleanup...");
    
    // Get stats before cleanup
    const statsBefore = await getPostStats();
    console.log("📊 Stats before cleanup:", statsBefore);
    
    // Run cleanup
    const result = await cleanupOldPosts();
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error,
          statsBefore,
        },
        { status: 500 }
      );
    }
    
    // Get stats after cleanup
    const statsAfter = await getPostStats();
    console.log("📊 Stats after cleanup:", statsAfter);
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old posts`,
      result,
      statsBefore,
      statsAfter,
    });
  } catch (error) {
    console.error("❌ Cleanup cron error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
