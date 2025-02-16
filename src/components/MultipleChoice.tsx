
import React from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

interface MultipleChoiceProps {
  options: string[];
  onSelect: (option: string) => void;
  answer?: string;
  correctAnswer?: string;
}

const MultipleChoice = ({
  options,
  onSelect,
  answer,
  correctAnswer,
}: MultipleChoiceProps) => {
  const getOptionStyle = (option: string) => {
    if (!answer) return "border-gray-200 hover:border-quiz-purple";
    if (option === correctAnswer) return "border-quiz-success bg-green-50";
    if (option === answer && answer !== correctAnswer)
      return "border-quiz-error bg-red-50";
    return "border-gray-200 opacity-50";
  };

  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <motion.button
          key={option}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          onClick={() => !answer && onSelect(option)}
          className={`w-full p-4 text-left border-2 rounded-lg transition-all ${getOptionStyle(
            option
          )} ${answer ? "cursor-default" : "cursor-pointer"}`}
          disabled={!!answer}
        >
          <div className="flex items-center justify-between">
            <span>{option}</span>
            {answer && option === correctAnswer && (
              <Check className="w-5 h-5 text-quiz-success" />
            )}
            {answer && option === answer && option !== correctAnswer && (
              <X className="w-5 h-5 text-quiz-error" />
            )}
          </div>
        </motion.button>
      ))}
    </div>
  );
};

export default MultipleChoice;
