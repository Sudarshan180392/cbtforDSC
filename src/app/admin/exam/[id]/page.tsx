"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

export default function AdminExamPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const examId = unwrappedParams.id;
  
  const [exam, setExam] = useState<any>(null);
  
  // Form State
  const [section, setSection] = useState("General Intelligence");
  const [text, setText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState("A");
  const [marks, setMarks] = useState("2");

  const fetchExam = async () => {
    const res = await fetch(`/api/exam/${examId}`);
    if (res.ok) {
      const data = await res.json();
      setExam(data.exam || data);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [examId]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId, section, text, optionA, optionB, optionC, optionD, correctOption, marks
      }),
    });
    if (res.ok) {
      alert("Question Added!");
      setText("");
      setOptionA(""); setOptionB(""); setOptionC(""); setOptionD("");
      fetchExam();
    }
  };

  if (!exam) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex-1 bg-gray-100 p-8 text-black">
      <div className="max-w-6xl mx-auto flex gap-6">
        
        {/* Left: Add Question Form */}
        <div className="flex-1 bg-white p-6 rounded shadow-md">
          <div className="mb-4 flex items-center gap-4">
             <Link href="/admin" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
             <h2 className="text-2xl font-bold">Add Question to: {exam.title}</h2>
          </div>
          
          <form onSubmit={handleAddQuestion}>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Section Name</label>
              <input required type="text" className="w-full border p-2 rounded" value={section} onChange={e => setSection(e.target.value)} placeholder="e.g., Quantitative Aptitude" />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Question Text</label>
              <textarea required className="w-full border p-2 rounded h-32" value={text} onChange={e => setText(e.target.value)}></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-bold mb-1">Option A</label>
                <input required type="text" className="w-full border p-2 rounded" value={optionA} onChange={e => setOptionA(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Option B</label>
                <input required type="text" className="w-full border p-2 rounded" value={optionB} onChange={e => setOptionB(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Option C</label>
                <input required type="text" className="w-full border p-2 rounded" value={optionC} onChange={e => setOptionC(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Option D</label>
                <input required type="text" className="w-full border p-2 rounded" value={optionD} onChange={e => setOptionD(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-bold mb-1">Correct Option</label>
                <select className="w-full border p-2 rounded" value={correctOption} onChange={e => setCorrectOption(e.target.value)}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold mb-1">Marks</label>
                <input required type="number" className="w-full border p-2 rounded" value={marks} onChange={e => setMarks(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">
              Add Question
            </button>
          </form>
        </div>

        {/* Right: Existing Questions List */}
        <div className="w-96 bg-white p-6 rounded shadow-md overflow-y-auto" style={{ maxHeight: "calc(100vh - 4rem)" }}>
          <h3 className="text-xl font-bold mb-4">Questions ({exam.questions?.length || 0})</h3>
          <div className="flex flex-col gap-4">
            {exam.questions?.map((q: any, i: number) => (
              <div key={q.id} className="border p-3 rounded bg-gray-50 text-sm">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold text-gray-500">Q{i + 1} | {q.section}</div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete Question ${i + 1}? This cannot be undone.`)) return;
                      await fetch(`/api/admin/question/${q.id}`, { method: "DELETE" });
                      fetchExam();
                    }}
                    className="text-red-500 hover:text-red-700 text-xs font-bold ml-2 flex-shrink-0"
                    title="Delete this question"
                  >
                    🗑️ Delete
                  </button>
                </div>
                <div className="mb-2 line-clamp-2 text-gray-800">{q.text}</div>
                <div className="text-gray-500 text-xs">
                  A: {q.optionA} &nbsp;|&nbsp; B: {q.optionB} &nbsp;|&nbsp; C: {q.optionC} &nbsp;|&nbsp; D: {q.optionD}
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-green-700 font-bold text-xs">✅ Correct: {q.correctOption}</span>
                  <span className="text-gray-500 text-xs">Marks: {q.marks}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
