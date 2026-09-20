import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const prisma = new PrismaClient();

async function checkAdminAccess() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) return null;
  return role;
}

export async function GET() {
  const role = await checkAdminAccess();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const batches = await prisma.batch.findMany({
      include: {
        activeExam: {
          select: { id: true, title: true, duration: true, totalMarks: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(batches);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  const role = await checkAdminAccess();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { name, activeExamId } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Batch name is required" }, { status: 400 });
    }

    const existing = await prisma.batch.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "A batch with this name already exists" }, { status: 409 });
    }

    const batch = await prisma.batch.create({
      data: {
        name: name.trim(),
        activeExamId: activeExamId ? parseInt(activeExamId) : null,
      },
      include: {
        activeExam: {
          select: { id: true, title: true },
        },
      },
    });
    return NextResponse.json(batch);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
