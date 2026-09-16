import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardAccess: true },
    });

    if (user?.dashboardAccess) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Dashboard access not granted" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
