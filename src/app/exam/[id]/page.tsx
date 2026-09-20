"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const examId = unwrappedParams.id;
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<any>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!user) return;
    
    fetch(`/api/exam/${examId}?userId=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.existingResult) {
          setResult(data.existingResult);
          setLoading(false);
          return;
        }

        setExam(data.exam);
        setTimeLeft(data.exam.duration * 60);
        
        // Initialize responses
        const initialResponses: any = {};
        data.exam.questions.forEach((q: any) => {
          initialResponses[q.id] = { status: "NOT_VISITED", selectedOption: null };
        });
        // Mark first as NOT_ANSWERED if not visited
        if (data.exam.questions.length > 0) {
          initialResponses[data.exam.questions[0].id].status = "NOT_ANSWERED";
        }
        setResponses(initialResponses);
        setLoading(false);
      });
  }, [examId, user]);

  useEffect(() => {
    if (!loading && timeLeft > 0 && !result) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !loading && !result) {
      handleSubmit();
    }
  }, [loading, timeLeft, result]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleOptionSelect = (option: string) => {
    const qId = exam.questions[currentQuestionIndex].id;
    setResponses((prev: any) => ({
      ...prev,
      [qId]: { ...prev[qId], selectedOption: option },
    }));
  };

  const goToQuestion = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= exam.questions.length) return;

    const currentQId = exam.questions[currentQuestionIndex].id;
    const currentResp = responses[currentQId];
    const isAnswered = currentResp?.selectedOption !== null && currentResp?.selectedOption !== undefined;

    setResponses((prev: any) => {
      const updated = { ...prev };
      const curStatus = updated[currentQId]?.status;

      if (isAnswered) {
        if (curStatus === "MARKED_FOR_REVIEW" || curStatus === "ANSWERED_AND_MARKED_FOR_REVIEW") {
          updated[currentQId] = { ...updated[currentQId], status: "ANSWERED_AND_MARKED_FOR_REVIEW" };
        } else {
          updated[currentQId] = { ...updated[currentQId], status: "ANSWERED" };
        }
      } else {
        if (curStatus === "MARKED_FOR_REVIEW" || curStatus === "ANSWERED_AND_MARKED_FOR_REVIEW") {
          updated[currentQId] = { ...updated[currentQId], status: "MARKED_FOR_REVIEW" };
        } else if (curStatus === "NOT_VISITED") {
          updated[currentQId] = { ...updated[currentQId], status: "NOT_ANSWERED" };
        }
      }

      const targetQId = exam.questions[targetIndex].id;
      if (updated[targetQId]?.status === "NOT_VISITED") {
        updated[targetQId] = { ...updated[targetQId], status: "NOT_ANSWERED" };
      }
      return updated;
    });

    setCurrentQuestionIndex(targetIndex);
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  const handleSectionClick = (sectionName: string) => {
    const firstQIndex = exam.questions.findIndex((q: any) => q.section === sectionName);
    if (firstQIndex !== -1) {
      goToQuestion(firstQIndex);
    }
  };

  const handleSaveAndNext = () => {
    const qId = exam.questions[currentQuestionIndex].id;
    const isAnswered = responses[qId]?.selectedOption !== null && responses[qId]?.selectedOption !== undefined;

    setResponses((prev: any) => ({
      ...prev,
      [qId]: { ...prev[qId], status: isAnswered ? "ANSWERED" : "NOT_ANSWERED" },
    }));

    if (currentQuestionIndex < exam.questions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  const handleClearResponse = () => {
    const qId = exam.questions[currentQuestionIndex].id;
    setResponses((prev: any) => ({
      ...prev,
      [qId]: { ...prev[qId], selectedOption: null, status: "NOT_ANSWERED" },
    }));
  };

  const handleMarkForReview = () => {
    const qId = exam.questions[currentQuestionIndex].id;
    const isAnswered = responses[qId]?.selectedOption !== null && responses[qId]?.selectedOption !== undefined;

    setResponses((prev: any) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        status: isAnswered ? "ANSWERED_AND_MARKED_FOR_REVIEW" : "MARKED_FOR_REVIEW",
      },
    }));

    if (currentQuestionIndex < exam.questions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (timeLeft > 0 && !confirm("Are you sure you want to submit the exam?")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, examId: parseInt(examId), responses }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
      alert("Error submitting exam");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/login");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ANSWERED": return "bg-green-500 text-white";
      case "NOT_ANSWERED": return "bg-red-500 text-white";
      case "MARKED_FOR_REVIEW": return "bg-purple-600 text-white";
      case "ANSWERED_AND_MARKED_FOR_REVIEW": return "bg-purple-600 text-white border-2 border-green-400";
      default: return "bg-gray-300 text-black";
    }
  };

  if (loading || !user) return <div className="p-10 text-center">Loading...</div>;

  if (result) {
    return (
      <div className="flex-1 bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded shadow-md max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4 text-black">Exam Submitted Successfully</h2>
          <div className="text-lg mb-2 text-black">Score: <span className="font-bold">{result.score}</span></div>
          <div className="text-green-600 mb-1">Correct: {result.correctCount}</div>
          <div className="text-red-600 mb-1">Incorrect: {result.incorrectCount}</div>
          <div className="text-gray-600 mb-4">Unanswered: {result.unansweredCount}</div>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm">
              ← Back to Dashboard
            </Link>
            <button onClick={handleLogout} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-medium text-sm">
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = exam.questions[currentQuestionIndex];
  const currentQResponse = responses[currentQ.id];
  const sections = Array.from(new Set(exam.questions.map((q: any) => q.section)));

  return (
    <div className="flex flex-col h-full bg-gray-100 font-sans">
      <header className="bg-blue-800 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xs bg-blue-900 hover:bg-blue-950 px-2.5 py-1.5 rounded border border-blue-700 font-medium">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold">{exam.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg">Candidate: {user.name} ({user.rollNo})</span>
          <span className="bg-blue-900 px-4 py-1 rounded border border-blue-700 font-mono text-xl">
            Time Left: {formatTime(timeLeft)}
          </span>
          <button onClick={handleLogout} className="ml-4 text-sm bg-red-600 hover:bg-red-700 px-3 py-1 rounded">Logout</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side */}
        <div className="flex-1 flex flex-col border-r border-gray-300 bg-white">
          {/* Section Navigation Tabs */}
          <div className="flex border-b bg-gray-100 overflow-x-auto shadow-inner">
             <span className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center bg-gray-200 flex-shrink-0 select-none">
               SECTIONS:
             </span>
             {sections.map((sec: any) => {
                const isActive = currentQ.section === sec;
                const secQuestions = exam.questions.filter((q: any) => q.section === sec);
                const answeredCount = secQuestions.filter((q: any) => {
                  const s = responses[q.id]?.status;
                  return s === "ANSWERED" || s === "ANSWERED_AND_MARKED_FOR_REVIEW";
                }).length;
                return (
                  <button
                    type="button"
                    key={sec}
                    onClick={() => handleSectionClick(sec)}
                    className={`px-4 py-3 font-semibold text-sm cursor-pointer border-r flex items-center gap-2 flex-shrink-0 transition-all ${
                      isActive
                        ? "bg-white text-blue-800 border-b-2 border-blue-600 font-bold shadow-sm"
                        : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    }`}
                  >
                    <span>{sec}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive ? "bg-blue-100 text-blue-800 font-bold" : "bg-gray-200 text-gray-700"
                    }`}>
                      {answeredCount}/{secQuestions.length}
                    </span>
                  </button>
                );
             })}
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex justify-between border-b pb-2 mb-6">
               <span className="font-bold text-lg text-black">Question No. {currentQuestionIndex + 1}</span>
               <span className="text-gray-600 font-semibold">Marks: {currentQ.marks} | Negative: {exam.negativeMarks}</span>
            </div>
            <div className="text-xl mb-8 text-black whitespace-pre-wrap">{currentQ.text}</div>
            
            <div className="flex flex-col gap-4">
              {["A", "B", "C", "D"].map((opt) => (
                <label key={opt} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer text-black transition-colors">
                  <input
                    type="radio"
                    name="option"
                    className="w-5 h-5 text-blue-600"
                    checked={currentQResponse?.selectedOption === opt}
                    onChange={() => handleOptionSelect(opt)}
                  />
                  <span>{currentQ[`option${opt}` as keyof typeof currentQ]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 p-4 border-t flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className={`px-4 py-2 border font-semibold rounded text-sm transition-colors ${
                  currentQuestionIndex === 0
                    ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-100"
                    : "border-gray-400 text-gray-700 hover:bg-gray-200 bg-white"
                }`}
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={handleClearResponse}
                className="px-4 py-2 border border-gray-400 text-gray-700 font-semibold rounded text-sm hover:bg-gray-200 bg-white transition-colors"
              >
                Clear Response
              </button>
              <button
                type="button"
                onClick={handleMarkForReview}
                className="px-4 py-2 border border-purple-600 text-purple-700 font-semibold rounded text-sm hover:bg-purple-50 bg-white transition-colors"
              >
                Mark for Review & Next
              </button>
            </div>
            <button
              type="button"
              onClick={handleSaveAndNext}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded text-sm hover:bg-blue-700 shadow-sm transition-colors"
            >
              {currentQuestionIndex === exam.questions.length - 1 ? "Save Response" : "Save & Next →"}
            </button>
          </div>
        </div>

        {/* Right Side */}
        <div className="w-80 flex flex-col bg-white">
           <div className="p-3 flex flex-col gap-1.5 text-xs border-b font-medium text-gray-700">
             <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-green-500 flex-shrink-0"></div> Answered</div>
             <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-red-500 flex-shrink-0"></div> Not Answered</div>
             <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-gray-300 flex-shrink-0"></div> Not Visited</div>
             <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-purple-600 flex-shrink-0"></div> Marked for Review</div>
             <div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-purple-600 border-2 border-green-400 flex-shrink-0"></div> Answered & Marked for Review</div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 bg-blue-50">
             <div className="mb-3">
               <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">
                 Filter Section:
               </label>
               <select
                 value={currentQ.section}
                 onChange={(e) => handleSectionClick(e.target.value)}
                 className="w-full p-2 border rounded font-bold text-xs text-blue-900 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
               >
                 {sections.map((sec: any) => (
                   <option key={sec} value={sec}>
                     {sec}
                   </option>
                 ))}
               </select>
             </div>

             <div className="text-xs font-bold text-blue-900 mb-2 flex justify-between items-center border-b border-blue-200 pb-1">
               <span>{currentQ.section}</span>
               <span className="text-[11px] text-gray-500 font-normal">
                 {exam.questions.filter((q: any) => q.section === currentQ.section).length} Questions
               </span>
             </div>

             <div className="grid grid-cols-5 gap-2.5">
               {exam.questions.map((q: any, i: number) => {
                 if (q.section !== currentQ.section) return null;
                 const status = responses[q.id]?.status || "NOT_VISITED";
                 const isCurrent = i === currentQuestionIndex;
                 return (
                   <button
                     type="button"
                     key={q.id}
                     onClick={() => goToQuestion(i)}
                     className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold shadow-sm transition-all hover:scale-105 ${getStatusColor(status)} ${
                       isCurrent ? "ring-2 ring-offset-2 ring-blue-600 scale-105 z-10" : ""
                     }`}
                     title={`Question ${i + 1} (${status.replace(/_/g, " ")})`}
                   >
                     {i + 1}
                   </button>
                 );
               })}
             </div>
           </div>

           <div className="p-4 border-t bg-gray-100 text-center">
              <button 
                onClick={handleSubmit} 
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded shadow-md text-lg"
              >
                {submitting ? "Submitting..." : "Submit Exam"}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
