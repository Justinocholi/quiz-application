
import React from "react";
import { cn } from "@/lib/utils";

interface QuizProgressProps {
  current: number;
  total: number;
  className?: string;
}

const QuizProgress = ({ current, total, className }: QuizProgressProps) => {
  const percentage = (current / total) * 100;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between mb-2 text-sm">
        <span>Goal: {total} points</span>
        <span>Current Points: {current}</span>
      </div>
      <div className="h-2 bg-quiz-purple-light rounded-full overflow-hidden">
        <div
          className="h-full bg-quiz-purple transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default QuizProgress;
