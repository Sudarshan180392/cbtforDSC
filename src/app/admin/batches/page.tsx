"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function AdminBatchesPage() {
  const { data: session } = useSession();
  const [batches, setBatches] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchExamId, setNewBatchExamId] = useState("");
  const [creating, setCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const fetchData = async () => {
    try {
      const [batchesRes, examsRes] = await Promise.all([
        fetch("/api/admin/batches"),
        fetch("/api/admin/exam"),
      ]);
      if (batchesRes.ok) setBatches(await batchesRes.json());
      if (examsRes.ok) setExams(await examsRes.json());
    } catch (e) {
      console.error("Error fetching batches/exams:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBatchName.trim(),
          activeExamId: newBatchExamId || null,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setNewBatchName("");
        setNewBatchExamId("");
        fetchData();
        showFeedback("✅ Batch created successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create batch");
      }
    } catch (e) {
      console.error(e);
      alert("Error creating batch");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateActiveExam = async (batchId: number, examId: string) => {
    try {
      const res = await fetch(`/api/admin/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeExamId: examId || null }),
      });
      if (res.ok) {
        fetchData();
        showFeedback("✅ Active exam updated for batch!");
      } else {
        alert("Failed to update active exam");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating active exam");
    }
  };

  const handleDeleteBatch = async (batchId: number, batchName: string) => {
    if (!confirm(`Delete batch "${batchName}"? Students enrolled in this batch will be unassigned but not deleted.`)) return;
    try {
      const res = await fetch(`/api/admin/batches/${batchId}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
        showFeedback(`🗑️ Batch "${batchName}" deleted.`);
      } else {
        alert("Failed to delete batch");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting batch");
    }
  };

  const showFeedback = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), 3500);
  };

  return (
    <div className="flex-1 bg-gray-100 p-8 text-black font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-sm text-blue-600 hover:underline">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-blue-900 mt-1">Batch & Exam Assignments</h1>
            <p className="text-sm text-gray-500">
              Group students into batches and assign which specific exam they will see upon logging in.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/students"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm shadow transition-colors"
            >
              🎓 Manage Students
            </Link>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm shadow transition-colors"
            >
              + Create New Batch
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm font-medium animate-fade-in">
            {statusMessage}
          </div>
        )}

        {/* Information Box */}
        <div className="bg-white border-l-4 border-blue-500 p-4 rounded shadow-sm mb-6 text-sm text-gray-700">
          <p className="font-semibold text-blue-900 mb-1">💡 How Batch Assignment Works:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Select the <strong>Active Exam</strong> for any batch in the table below.</li>
            <li>When any student enrolled in that batch logs in, they will be <strong>directed immediately to that test</strong>.</li>
            <li>You can change the active exam anytime. Changes take effect on the student&apos;s next login.</li>
          </ul>
        </div>

        {/* Batches Table */}
        <div className="bg-white rounded shadow overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-500 font-semibold">Loading Batches...</div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">🏷️</div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">No Batches Configured</h3>
              <p className="text-sm mb-4">Create your first batch to start assigning custom exams to groups of students.</p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm"
              >
                + Create Batch
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 font-semibold">
                  <th className="p-4">#</th>
                  <th className="p-4">Batch Name</th>
                  <th className="p-4">Enrolled Students</th>
                  <th className="p-4">Assigned Active Exam</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch, i) => (
                  <tr key={batch.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-400">{i + 1}</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{batch.name}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 text-indigo-700 font-semibold text-xs px-2.5 py-1 rounded-full">
                        👥 {batch._count?.users || 0} student{(batch._count?.users || 0) === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={batch.activeExamId || ""}
                          onChange={(e) => handleUpdateActiveExam(batch.id, e.target.value)}
                          className="p-2 border rounded font-medium text-xs text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 min-w-[220px]"
                        >
                          <option value="">-- No Exam Assigned --</option>
                          {exams.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.title} ({ex.duration}m | {ex.totalMarks} marks)
                            </option>
                          ))}
                        </select>
                        {batch.activeExam ? (
                          <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteBatch(batch.id, batch.name)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete Batch"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Batch Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl font-bold mb-1 text-gray-900">Create New Batch</h2>
              <p className="text-xs text-gray-500 mb-4">
                Enter a batch name (e.g., Morning SSC, Weekend Batch) and optionally select an initial exam.
              </p>

              <form onSubmit={handleCreateBatch}>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Batch Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Morning SSC 2026"
                    value={newBatchName}
                    onChange={(e) => setNewBatchName(e.target.value)}
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Initial Assigned Exam (Optional)
                  </label>
                  <select
                    className="w-full p-2.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={newBatchExamId}
                    onChange={(e) => setNewBatchExamId(e.target.value)}
                  >
                    <option value="">-- None (Assign Later) --</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.duration}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold shadow"
                  >
                    {creating ? "Creating..." : "Create Batch"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
