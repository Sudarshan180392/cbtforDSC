import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Only Superadmin can delete exams" }, { status: 403 });
  }

  try {
    const params = await context.params;
    const id = parseInt(params.id);

    // Delete in order: responses → results → questions → exam
    const questions = await prisma.question.findMany({ where: { examId: id }, select: { id: true } });
    const questionIds = questions.map((q) => q.id);

    await prisma.response.deleteMany({ where: { questionId: { in: questionIds } } });
    await prisma.result.deleteMany({ where: { examId: id } });
    await prisma.question.deleteMany({ where: { examId: id } });
    await prisma.exam.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
