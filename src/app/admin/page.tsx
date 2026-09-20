"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function AdminDashboard() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [exams, setExams] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [totalMarks, setTotalMarks] = useState("200");
  const [negativeMarks, setNegativeMarks] = useState("0.5");

  const fetchExams = async () => {
    const res = await fetch("/api/admin/exam");
    if (res.ok) setExams(await res.json());
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, duration, totalMarks, negativeMarks }),
    });
    if (res.ok) {
      setShowModal(false);
      fetchExams();
      setTitle("");
    }
  };

  const handleDeleteExam = async (examId: number, examTitle: string) => {
    if (!confirm(`⚠️ Delete exam "${examTitle}" and ALL its questions, responses & results? This cannot be undone!`)) return;
    const res = await fetch(`/api/admin/exam/${examId}`, { method: "DELETE" });
    if (res.ok) fetchExams();
    else alert("Failed to delete exam.");
  };

  return (
    <div className="flex-1 bg-gray-100 p-8 text-black">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">Admin Dashboard</h1>
          <div className="flex gap-3 items-center">
            {role === "SUPERADMIN" && (
              <Link href="/admin/users" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded text-sm">
                👥 Manage Users
              </Link>
            )}
            <Link href="/admin/batches" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded text-sm shadow transition-colors">
              🏷️ Batches & Assignments
            </Link>
            <Link href="/admin/students" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm shadow transition-colors">
              🎓 Manage Students
            </Link>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              + Create New Exam
            </button>
            <button onClick={() => signOut({ callbackUrl: "/admin-login" })} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded text-sm">
              Sign Out
            </button>
          </div>
        </div>

        <div className="bg-white rounded shadow">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-4">ID</th>
                <th className="p-4">Title</th>
                <th className="p-4">Questions</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam: any) => (
                <tr key={exam.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{exam.id}</td>
                  <td className="p-4 font-semibold">{exam.title}</td>
                  <td className="p-4">{exam._count.questions}</td>
                  <td className="p-4">{exam.duration} mins</td>
                  <td className="p-4 flex gap-2">
                    <Link href={`/admin/exam/${exam.id}`} className="text-blue-600 hover:underline text-sm">
                      Manage Questions
                    </Link>
                    {role === "SUPERADMIN" && (
                      <button
                        onClick={() => handleDeleteExam(exam.id, exam.title)}
                        className="text-red-500 hover:text-red-700 text-sm font-bold"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Exam</h2>
            <form onSubmit={handleCreate}>
              <div className="mb-3">
                <label className="block text-sm font-bold mb-1">Exam Title</label>
                <input required type="text" className="w-full border p-2 rounded" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold mb-1">Duration (minutes)</label>
                <input required type="number" className="w-full border p-2 rounded" value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div className="mb-3 flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">Total Marks</label>
                  <input required type="number" className="w-full border p-2 rounded" value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold mb-1">Negative Marks</label>
                  <input required type="number" step="0.1" className="w-full border p-2 rounded" value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
