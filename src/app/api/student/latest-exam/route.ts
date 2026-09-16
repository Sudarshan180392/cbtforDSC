import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

// Returns the most recently created exam ID
export async function GET() {
  try {
    const latestExam = await prisma.exam.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });

    if (!latestExam) {
      return NextResponse.json({ error: "No exams available" }, { status: 404 });
    }

    return NextResponse.json({ examId: latestExam.id });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
