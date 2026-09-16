"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      checkAccess(parsedUser.id);
    } else {
      router.push("/login");
    }
  }, [router]);

  const checkAccess = async (userId: number) => {
    try {
      const res = await fetch("/api/student/dashboard-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setUnlocked(true);
        fetchExamsForUser(userId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
      setLoading(false);
    }
  };

  const fetchExamsForUser = async (userId: number) => {
    try {
      const res = await fetch(`/api/student/exams?userId=${userId}`);
      if (res.ok) setExams(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (loading || !user) {
    return <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-600 font-semibold text-lg">Loading...</div>;
  }

  // Gate: show locked message if no access
  if (!unlocked) {
    return (
      <div className="flex-1 flex flex-col bg-gray-100 font-sans">
        <header className="bg-blue-800 text-white px-6 py-4 flex justify-between items-center shadow-md">
          <div>
            <h1 className="text-xl font-bold">CBT Examination Portal</h1>
            <p className="text-xs text-blue-200">Test Series Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="font-semibold text-sm">{user.name}</div>
              <div className="text-xs text-blue-200 font-mono">Roll: {user.rollNo}</div>
            </div>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded">Logout</button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Test Series — Locked</h2>
            <p className="text-gray-500 text-sm mb-4">
              Your access to the full Test Series Dashboard has not been activated yet.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Please contact your institute&apos;s Superadmin to get dashboard access enabled for your account.
            </p>
            <a href="/login" className="text-blue-600 hover:underline text-sm">← Back to Login</a>
          </div>
        </div>
      </div>
    );
  }

  // Unlocked: show full dashboard
  return (
    <div className="flex-1 flex flex-col bg-gray-100 font-sans">
      <header className="bg-blue-800 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl font-bold tracking-wide">CBT Examination Portal</h1>
          <p className="text-xs text-blue-200">Test Series Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="font-semibold text-sm">{user.name}</div>
            <div className="text-xs text-blue-200 font-mono">Roll: {user.rollNo}</div>
          </div>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded shadow">
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        <div className="mb-6 flex justify-between items-end border-b pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">All Test Papers</h2>
            <p className="text-sm text-gray-500 mt-1">Select a test to start or view your performance.</p>
          </div>
          <div className="text-sm font-semibold text-blue-900 bg-blue-100 px-3 py-1 rounded-full">
            Total: {exams.length}
          </div>
        </div>

        {exams.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="text-lg font-bold text-gray-700 mb-1">No Tests Available</h3>
            <p className="text-sm">Check back later for new test papers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div key={exam.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{exam.title}</h3>
                    {exam.isSubmitted ? (
                      <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">Completed</span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">Pending</span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 mt-4 border-t pt-3">
                    <div className="flex justify-between"><span className="text-gray-500">Duration:</span><span className="font-semibold text-gray-800">{exam.duration} min</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Questions:</span><span className="font-semibold text-gray-800">{exam.questionCount}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Marks:</span><span className="font-semibold text-gray-800">{exam.totalMarks}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Negative:</span><span className="font-semibold text-red-600">-{exam.negativeMarks}</span></div>
                  </div>
                  {exam.isSubmitted && exam.result && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded p-3 text-xs">
                      <div className="font-bold text-blue-900 mb-1">Your Score:</div>
                      <div className="flex justify-between text-blue-800">
                        <span>Score: <b>{exam.result.score}</b>/{exam.totalMarks}</span>
                        <span className="text-green-600"><b>{exam.result.correctCount}</b> ✓</span>
                        <span className="text-red-600"><b>{exam.result.incorrectCount}</b> ✗</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 border-t">
                  {exam.isSubmitted ? (
                    <Link href={`/exam/${exam.id}`} className="block w-full text-center bg-gray-700 hover:bg-gray-800 text-white font-bold py-2.5 px-4 rounded text-sm">
                      View Summary
                    </Link>
                  ) : (
                    <Link href={`/exam/${exam.id}`} className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded text-sm shadow-sm">
                      Start Exam →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
