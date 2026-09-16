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
    const exams = await prisma.exam.findMany({
      include: { _count: { select: { questions: true, results: true } } },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(exams);
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
    const { title, duration, totalMarks, negativeMarks } = await request.json();
    const exam = await prisma.exam.create({
      data: {
        title,
        duration: parseInt(duration),
        totalMarks: parseInt(totalMarks),
        negativeMarks: parseFloat(negativeMarks),
      },
    });
    return NextResponse.json(exam);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
