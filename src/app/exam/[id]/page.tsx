"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

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

  const goToQuestion = (index: number) => {
    const currentQId = exam.questions[currentQuestionIndex].id;
    const currentStatus = responses[currentQId].status;
    const isAnswered = responses[currentQId].selectedOption !== null;

    if (currentStatus === "NOT_VISITED" || currentStatus === "NOT_ANSWERED") {
       setResponses((prev: any) => ({
          ...prev,
          [currentQId]: { ...prev[currentQId], status: isAnswered ? "ANSWERED" : "NOT_ANSWERED" }
       }));
    }

    const newQId = exam.questions[index].id;
    if (responses[newQId].status === "NOT_VISITED") {
        setResponses((prev: any) => ({
            ...prev,
            [newQId]: { ...prev[newQId], status: "NOT_ANSWERED" }
        }));
    }
    setCurrentQuestionIndex(index);
  };

  const handleSaveAndNext = () => {
    const qId = exam.questions[currentQuestionIndex].id;
    const isAnswered = responses[qId].selectedOption !== null;
    
    setResponses((prev: any) => ({
      ...prev,
      [qId]: { ...prev[qId], status: isAnswered ? "ANSWERED" : "NOT_ANSWERED" }
    }));

    if (currentQuestionIndex < exam.questions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  const handleClearResponse = () => {
    const qId = exam.questions[currentQuestionIndex].id;
    setResponses((prev: any) => ({
      ...prev,
      [qId]: { ...prev[qId], selectedOption: null, status: "NOT_ANSWERED" }
    }));
  };

  const handleMarkForReview = () => {
    const qId = exam.questions[currentQuestionIndex].id;
    const isAnswered = responses[qId].selectedOption !== null;
    
    setResponses((prev: any) => ({
      ...prev,
      [qId]: { ...prev[qId], status: isAnswered ? "ANSWERED_AND_MARKED_FOR_REVIEW" : "MARKED_FOR_REVIEW" }
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
          <button onClick={handleLogout} className="bg-blue-600 text-white px-4 py-2 rounded">Logout</button>
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
        <h1 className="text-xl font-bold">{exam.title}</h1>
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
          <div className="flex border-b bg-gray-50 overflow-x-auto">
             {sections.map((sec: any) => (
                <div key={sec} className={`p-3 font-semibold text-sm cursor-pointer border-r ${currentQ.section === sec ? "bg-blue-100 text-blue-800 border-b-2 border-blue-600" : "text-gray-600"}`}>
                  {sec}
                </div>
             ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex justify-between border-b pb-2 mb-6">
               <span className="font-bold text-lg text-black">Question No. {currentQuestionIndex + 1}</span>
               <span className="text-gray-600 font-semibold">Marks: {currentQ.marks} | Negative: {exam.negativeMarks}</span>
            </div>
            <div className="text-xl mb-8 text-black whitespace-pre-wrap">{currentQ.text}</div>
            
            <div className="flex flex-col gap-4">
              {["A", "B", "C", "D"].map((opt) => (
                <label key={opt} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer text-black">
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
          <div className="bg-gray-50 p-4 border-t flex justify-between items-center">
            <div className="flex gap-3">
              <button onClick={handleMarkForReview} className="px-4 py-2 border border-purple-600 text-purple-700 font-semibold rounded hover:bg-purple-50">
                Mark for Review & Next
              </button>
              <button onClick={handleClearResponse} className="px-4 py-2 border border-gray-400 text-gray-700 font-semibold rounded hover:bg-gray-200">
                Clear Response
              </button>
            </div>
            <button onClick={handleSaveAndNext} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 shadow-sm">
              Save & Next
            </button>
          </div>
        </div>

        {/* Right Side */}
        <div className="w-80 flex flex-col bg-white">
           <div className="p-4 flex flex-col gap-2 text-sm border-b font-medium text-gray-700">
             <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-green-500"></div> Answered</div>
             <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-red-500"></div> Not Answered</div>
             <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-gray-300"></div> Not Visited</div>
             <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-purple-600"></div> Marked for Review</div>
             <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-purple-600 border-2 border-green-400"></div> Answered & Marked for Review</div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 bg-blue-50">
             <div className="font-bold mb-4 text-blue-900 border-b border-blue-200 pb-2">{currentQ.section}</div>
             <div className="grid grid-cols-5 gap-3">
               {exam.questions.map((q: any, i: number) => {
                 if (q.section !== currentQ.section) return null;
                 const status = responses[q.id]?.status || "NOT_VISITED";
                 return (
                   <button
                     key={q.id}
                     onClick={() => goToQuestion(i)}
                     className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold shadow-sm transition-transform hover:scale-105 ${getStatusColor(status)} ${i === currentQuestionIndex ? "ring-2 ring-offset-1 ring-blue-500" : ""}`}
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
