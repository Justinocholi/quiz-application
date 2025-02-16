
import React, { useState } from "react";
import { motion } from "framer-motion";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

interface Item {
  id: string;
  content: string;
}

interface DragAndDropProps {
  items: Item[];
  matches: Item[];
  onMatch: (matches: { itemId: string; targetId: string }[]) => void;
}

const DragAndDrop = ({ items, matches, onMatch }: DragAndDropProps) => {
  const [currentMatches, setCurrentMatches] = useState<
    { itemId: string; targetId: string }[]
  >([]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const match = {
      itemId: result.draggableId,
      targetId: result.destination.droppableId,
    };

    const newMatches = [...currentMatches];
    const existingMatchIndex = newMatches.findIndex(
      (m) => m.itemId === match.itemId || m.targetId === match.targetId
    );

    if (existingMatchIndex >= 0) {
      newMatches[existingMatchIndex] = match;
    } else {
      newMatches.push(match);
    }

    setCurrentMatches(newMatches);
    if (newMatches.length === items.length) {
      onMatch(newMatches);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <Droppable droppableId="items" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex flex-wrap gap-2"
            >
              {items.map((item, index) => (
                <Draggable
                  key={item.id}
                  draggableId={item.id}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <motion.div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`px-4 py-2 bg-white border-2 border-quiz-purple rounded-lg cursor-grab ${
                        snapshot.isDragging ? "shadow-lg" : ""
                      }`}
                    >
                      {item.content}
                    </motion.div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        <div className="space-y-3">
          {matches.map((match) => (
            <Droppable key={match.id} droppableId={match.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`p-4 border-2 ${
                    snapshot.isDraggingOver
                      ? "border-quiz-purple bg-quiz-purple-light"
                      : "border-gray-200"
                  } rounded-lg min-h-[60px] transition-colors`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{match.content}</span>
                    {currentMatches.find((m) => m.targetId === match.id) && (
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="px-3 py-1 bg-quiz-purple text-white rounded"
                      >
                        {
                          items.find(
                            (item) =>
                              item.id ===
                              currentMatches.find(
                                (m) => m.targetId === match.id
                              )?.itemId
                          )?.content
                        }
                      </motion.div>
                    )}
                  </div>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </div>
    </DragDropContext>
  );
};

export default DragAndDrop;
