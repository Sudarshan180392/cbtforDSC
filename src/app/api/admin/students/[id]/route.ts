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
    const { password } = await request.json();
    const updated = await prisma.user.update({ where: { id }, data: { password } });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
