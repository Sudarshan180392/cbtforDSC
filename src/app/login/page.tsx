"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [rollNo, setRollNo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo, password }),
      });

      if (res.ok) {
        const user = await res.json();
        localStorage.setItem("user", JSON.stringify(user));
        
        // Fetch the assigned exam for student's batch (or fallback to latest)
        const examRes = await fetch(`/api/student/latest-exam?userId=${user.id}`);
        if (examRes.ok) {
          const { examId } = await examRes.json();
          router.push(`/exam/${examId}`);
        } else {
          router.push("/dashboard");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("An error occurred");
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-800">CBT Exam Login</h2>
        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Roll Number</label>
            <input
              type="text"
              className="w-full p-3 border rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              className="w-full p-3 border rounded text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Login
          </button>
        </form>
        <div className="mt-4 text-sm text-gray-600 text-center">
          Test Account: <br /> Roll No: <b>DSC010</b> <br /> Password: <b>12345</b>
        </div>
      </div>
    </div>
  );
}
