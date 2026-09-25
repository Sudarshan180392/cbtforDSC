import { PrismaClient } from "@prisma/client";
import { BatchExamReportData, StudentResultRow } from "./pdfReportGenerator";

const prisma = new PrismaClient();

export async function getBatchExamReportData(
  batchId: number,
  examId?: number
): Promise<{ data: BatchExamReportData | null; error?: string }> {
  try {
    // 1. Fetch Batch
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        activeExam: true,
        users: {
          where: { role: "STUDENT" },
          orderBy: { rollNo: "asc" },
        },
      },
    });

    if (!batch) {
      return { data: null, error: "Batch not found" };
    }

    // Determine target exam ID: either passed in or the batch's active exam
    const targetExamId = examId || batch.activeExamId;
    if (!targetExamId) {
      return { data: null, error: "No exam assigned or selected for this batch" };
    }

    // 2. Fetch Exam with question count
    const exam = await prisma.exam.findUnique({
      where: { id: targetExamId },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!exam) {
      return { data: null, error: "Exam not found" };
    }

    // 3. Fetch all Results for this exam and enrolled batch students
    const userIds = batch.users.map((u) => u.id);
    const results = await prisma.result.findMany({
      where: {
        examId: targetExamId,
        userId: { in: userIds },
      },
    });

    const resultMap = new Map<number, (typeof results)[0]>();
    results.forEach((r) => resultMap.set(r.userId, r));

    // 4. Build Student Rows
    const rawStudentRows: StudentResultRow[] = batch.users.map((user) => {
      const res = resultMap.get(user.id);
      const isSubmitted = !!res;
      const score = res ? res.score : 0;
      const correctCount = res ? res.correctCount : 0;
      const incorrectCount = res ? res.incorrectCount : 0;
      const unansweredCount = res ? res.unansweredCount : exam._count.questions;
      const percentage =
        isSubmitted && exam.totalMarks > 0
          ? Math.max(0, Math.min(100, (score / exam.totalMarks) * 100))
          : 0;

      return {
        rank: "—",
        rollNo: user.rollNo,
        name: user.name,
        isSubmitted,
        score,
        correctCount,
        incorrectCount,
        unansweredCount,
        percentage,
        submittedAt: res ? res.createdAt.toISOString() : undefined,
      };
    });

    // 5. Compute Batch Ranking with Competitive Tie-Breakers:
    // Sort submitted students:
    // 1st: Score descending
    // 2nd: Correct Count descending
    // 3rd: Incorrect Count ascending (higher accuracy)
    const submittedStudents = rawStudentRows
      .filter((s) => s.isSubmitted)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
        return a.incorrectCount - b.incorrectCount;
      });

    // Assign rank with standard competition ranking (1, 2, 2, 4...)
    let currentRank = 1;
    for (let i = 0; i < submittedStudents.length; i++) {
      if (i > 0) {
        const prev = submittedStudents[i - 1];
        const curr = submittedStudents[i];
        const isTied =
          curr.score === prev.score &&
          curr.correctCount === prev.correctCount &&
          curr.incorrectCount === prev.incorrectCount;

        if (!isTied) {
          currentRank = i + 1;
        }
      }
      submittedStudents[i].rank = currentRank;
    }

    // Pending students stay unranked
    const unsubmittedStudents = rawStudentRows.filter((s) => !s.isSubmitted);

    // Combine all students: ranked submitted first, followed by pending
    const allStudents = [...submittedStudents, ...unsubmittedStudents];

    // 6. Aggregate Statistics
    const totalEnrolled = batch.users.length;
    const totalSubmitted = submittedStudents.length;
    const totalPending = totalEnrolled - totalSubmitted;
    const isAllSubmitted = totalEnrolled > 0 && totalSubmitted === totalEnrolled;

    const totalScoresSum = submittedStudents.reduce((sum, s) => sum + s.score, 0);
    const classAverage = totalSubmitted > 0 ? totalScoresSum / totalSubmitted : 0;
    const highestScore = totalSubmitted > 0 ? submittedStudents[0].score : 0;
    const lowestScore = totalSubmitted > 0 ? submittedStudents[submittedStudents.length - 1].score : 0;
    const topper = submittedStudents.length > 0 ? submittedStudents[0] : null;

    const reportData: BatchExamReportData = {
      instituteName: "CBT EXAMINATION PORTAL",
      batchName: batch.name,
      examTitle: exam.title,
      examDuration: exam.duration,
      totalMarks: exam.totalMarks,
      negativeMarks: exam.negativeMarks,
      questionCount: exam._count.questions,
      generatedAt: new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      stats: {
        totalEnrolled,
        totalSubmitted,
        totalPending,
        isAllSubmitted,
        classAverage,
        highestScore,
        lowestScore,
        topperName: topper?.name,
        topperRoll: topper?.rollNo,
      },
      students: allStudents,
    };

    return { data: reportData };
  } catch (error) {
    console.error("Error generating batch exam report data:", error);
    return { data: null, error: "Internal server error while fetching batch report data" };
  } finally {
    await prisma.$disconnect();
  }
}
