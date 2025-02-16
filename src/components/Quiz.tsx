
import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import QuizProgress from "./QuizProgress";
import MultipleChoice from "./MultipleChoice";
import DragAndDrop from "./DragAndDrop";

interface Question {
  id: number;
  type: "multiple-choice" | "drag-drop";
  question: string;
  options?: string[];
  correctAnswer?: string;
  items?: { id: string; content: string }[];
  matches?: { id: string; content: string }[];
  points: number;
}

const questions: Question[] = [
  {
    id: 1,
    type: "multiple-choice",
    question: "What role does sunlight play in photosynthesis?",
    options: [
      "It provides energy to make food",
      "It helps plants absorb water",
      "It turns leaves green",
    ],
    correctAnswer: "It provides energy to make food",
    points: 10,
  },
  {
    id: 2,
    type: "drag-drop",
    question: "Match the algebraic terms with their definitions",
    items: [
      { id: "variable", content: "Variable" },
      { id: "constant", content: "Constant" },
      { id: "coefficient", content: "Coefficient" },
      { id: "expression", content: "Expression" },
    ],
    matches: [
      {
        id: "variable-def",
        content: "A symbol that can represent different values",
      },
      { id: "constant-def", content: "A value that doesn't change" },
      {
        id: "coefficient-def",
        content: "A number that multiplies a variable",
      },
      {
        id: "expression-def",
        content: "A combination of numbers and variables",
      },
    ],
    points: 20,
  },
];

const Quiz = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});

  const currentQuestion = questions[currentQuestionIndex];
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  const handleAnswer = (answer: any) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    if (currentQuestion.type === "multiple-choice") {
      if (answer === currentQuestion.correctAnswer) {
        setScore((prev) => prev + currentQuestion.points);
      }
    } else if (currentQuestion.type === "drag-drop") {
      // Calculate score for drag-drop based on correct matches
      const correctMatches = answer.filter(
        (match: any) =>
          match.itemId === match.targetId.replace("-def", "")
      ).length;
      const pointsPerMatch = currentQuestion.points / 4; // Assuming 4 matches
      setScore((prev) => prev + correctMatches * pointsPerMatch);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex((prev) => prev + 1);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-quiz-purple-light p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center mb-6">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="ml-4">
              <h2 className="text-sm text-gray-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </h2>
            </div>
          </div>

          <QuizProgress
            current={score}
            total={totalPoints}
            className="mb-8"
          />

          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-xl font-semibold mb-6">
              {currentQuestion.question}
            </h1>

            {currentQuestion.type === "multiple-choice" ? (
              <MultipleChoice
                options={currentQuestion.options || []}
                onSelect={handleAnswer}
                answer={answers[currentQuestion.id]}
                correctAnswer={currentQuestion.correctAnswer}
              />
            ) : (
              <DragAndDrop
                items={currentQuestion.items || []}
                matches={currentQuestion.matches || []}
                onMatch={handleAnswer}
              />
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Quiz;
