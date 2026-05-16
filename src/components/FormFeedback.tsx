import { cn } from '../lib/utils';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface FeedbackState {
  type: 'success' | 'error';
  text: string;
}

export default function FormFeedback({ feedback }: { feedback: FeedbackState | null }) {
  if (feedback?.type === 'success' && typeof navigator !== 'undefined') {
    navigator.vibrate?.(50);
  }

  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold",
            feedback.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}
        >
          {feedback.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />
          }
          {feedback.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
