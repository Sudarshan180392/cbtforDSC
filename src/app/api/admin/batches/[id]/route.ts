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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = await checkAdminAccess();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const params = await context.params;
    const id = parseInt(params.id);
    const body = await request.json();

    const dataToUpdate: any = {};
    if ("name" in body) {
      if (!body.name || !body.name.trim()) {
        return NextResponse.json({ error: "Batch name cannot be empty" }, { status: 400 });
      }
      dataToUpdate.name = body.name.trim();
    }
    if ("activeExamId" in body) {
      dataToUpdate.activeExamId = body.activeExamId ? parseInt(body.activeExamId) : null;
    }

    const updated = await prisma.batch.update({
      where: { id },
      data: dataToUpdate,
      include: {
        activeExam: {
          select: { id: true, title: true, duration: true, totalMarks: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = await checkAdminAccess();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const params = await context.params;
    const id = parseInt(params.id);

    // Unassign users first, then delete batch
    await prisma.user.updateMany({
      where: { batchId: id },
      data: { batchId: null },
    });

    await prisma.batch.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
