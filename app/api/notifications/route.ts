import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET - Fetch all active notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    const notifications = await prisma.notification.findMany({
      where: {
        isDismissed: false,
        ...(unreadOnly ? { isRead: false } : {}),
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        isRead: false,
        isDismissed: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      severity = "INFO",
      title,
      message,
      actionUrl,
      actionLabel,
      accountId,
      metadata,
      expiresAt,
    } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: "type, title, and message are required" },
        { status: 400 }
      );
    }

    // Check for duplicate notification in last hour
    const recentDuplicate = await prisma.notification.findFirst({
      where: {
        type,
        accountId,
        isDismissed: false,
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentDuplicate) {
      // Update existing instead of creating new
      const updated = await prisma.notification.update({
        where: { id: recentDuplicate.id },
        data: {
          message,
          isRead: false,
          createdAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        notification: updated,
        updated: true,
      });
    }

    const notification = await prisma.notification.create({
      data: {
        type,
        severity,
        title,
        message,
        actionUrl,
        actionLabel,
        accountId,
        metadata,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

// PATCH - Mark notifications as read or dismissed
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, markAsRead, dismiss, markAllRead } = body;

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { isRead: false, isDismissed: false },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, message: "All marked as read" });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "ids array required" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (markAsRead) updateData.isRead = true;
    if (dismiss) updateData.isDismissed = true;

    await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
