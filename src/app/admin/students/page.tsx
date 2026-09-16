"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add student form
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adding, setAdding] = useState(false);

  // Reset password modal
  const [resetStudent, setResetStudent] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  const fetchStudents = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/students");
    if (res.ok) setStudents(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setAdding(true);

    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rollNo, password }),
    });

    setAdding(false);
    if (res.ok) {
      setSuccess(`✅ Student "${name}" added successfully!`);
      setName("");
      setRollNo("");
      setPassword("");
      fetchStudents();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to add student");
    }
  };

  const handleDelete = async (id: number, studentName: string) => {
    if (!confirm(`Delete "${studentName}"? This will also delete all their exam responses and results.`)) return;
    await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    fetchStudents();
  };

  const handleResetPassword = async () => {
    if (!newPassword) return;
    await fetch(`/api/admin/students/${resetStudent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    setResetStudent(null);
    setNewPassword("");
    alert("Password reset successfully!");
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-gray-100 p-6 text-black">
      <div className="max-w-6xl mx-auto flex gap-6">

        {/* Left: Add Student Form */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded shadow-md p-6 sticky top-4">
            <h2 className="text-xl font-bold mb-1 text-blue-900">Add New Student</h2>
            <p className="text-gray-500 text-xs mb-4">Students use Roll No & Password to log in.</p>

            {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-3 text-sm">{error}</div>}
            {success && <div className="bg-green-100 text-green-700 p-2 rounded mb-3 text-sm">{success}</div>}

            <form onSubmit={handleAddStudent}>
              <div className="mb-3">
                <label className="block text-sm font-bold mb-1">Full Name</label>
                <input required type="text" className="w-full border p-2 rounded text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Kumar" />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-bold mb-1">Roll Number (Login ID)</label>
                <input required type="text" className="w-full border p-2 rounded text-sm" value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="e.g. SSC20260001" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Password</label>
                <input required type="text" className="w-full border p-2 rounded text-sm" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="e.g. DOB like 01011998" />
                <p className="text-xs text-gray-400 mt-1">Tip: Use date of birth as password</p>
              </div>
              <button type="submit" disabled={adding} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded">
                {adding ? "Adding..." : "+ Add Student"}
              </button>
            </form>

            <hr className="my-4" />
            <Link href="/admin" className="text-blue-600 hover:underline text-sm">← Back to Dashboard</Link>
          </div>
        </div>

        {/* Right: Students List */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-blue-900">
              Students <span className="text-gray-400 text-lg font-normal">({students.length})</span>
            </h1>
            <input
              type="text"
              placeholder="Search by name or roll no..."
              className="border p-2 rounded text-sm w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600">
                  <th className="p-4">#</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Roll No</th>
                  <th className="p-4">Exams Given</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, i) => (
                  <tr key={student.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 text-gray-400">{i + 1}</td>
                    <td className="p-4 font-semibold">{student.name}</td>
                    <td className="p-4 font-mono bg-gray-50">{student.rollNo}</td>
                    <td className="p-4">
                      {student.results.length > 0 ? (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                          {student.results.length} exam{student.results.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not yet</span>
                      )}
                    </td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => { setResetStudent(student); setNewPassword(""); }}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs px-3 py-1 rounded"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => handleDelete(student.id, student.name)}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="p-8 text-center text-gray-400">Loading students...</div>}
            {!loading && filtered.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                {search ? "No students match your search." : "No students added yet. Add your first student!"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-bold mb-1">Reset Password</h3>
            <p className="text-gray-500 text-sm mb-4">Resetting password for: <b>{resetStudent.name}</b> ({resetStudent.rollNo})</p>
            <input
              type="text"
              className="w-full border p-2 rounded mb-4"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResetStudent(null)} className="px-4 py-2 border rounded text-sm">Cancel</button>
              <button onClick={handleResetPassword} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Save New Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
