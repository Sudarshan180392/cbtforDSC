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

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = await checkAdminAccess();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const params = await context.params;
    const id = parseInt(params.id);
    await prisma.response.deleteMany({ where: { userId: id } });
    await prisma.result.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = await checkAdminAccess();
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const params = await context.params;
    const id = parseInt(params.id);
    const body = await request.json();

    // If toggling dashboard access — only SUPERADMIN can do this
    if ("dashboardAccess" in body) {
      if (role !== "SUPERADMIN") {
        return NextResponse.json({ error: "Only Superadmin can toggle dashboard access" }, { status: 403 });
      }
      const updated = await prisma.user.update({
        where: { id },
        data: { dashboardAccess: body.dashboardAccess },
      });
      return NextResponse.json(updated);
    }

    // Password reset — both ADMIN and SUPERADMIN can do this
    if ("password" in body) {
      const updated = await prisma.user.update({
        where: { id },
        data: { password: body.password },
      });
      return NextResponse.json(updated);
    }

    // Batch assignment — both ADMIN and SUPERADMIN can do this
    if ("batchId" in body) {
      const updated = await prisma.user.update({
        where: { id },
        data: { batchId: body.batchId ? parseInt(body.batchId) : null },
        include: {
          batch: { select: { id: true, name: true } },
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
