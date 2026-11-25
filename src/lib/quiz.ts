export type QuizMode = "text" | "image" | "mixed";

export interface QuizQuestion {
  id: string;
  kind: "text" | "image";
  prompt: string;
  image_url: string | null;
  options: string[];
  correct_index: number;
  explanation: string;
  source_ref: string | null;
}

export const MODE_LABELS: Record<QuizMode, string> = {
  text: "Quiz tradicional",
  image: "Quiz de imagens",
  mixed: "Quiz misto",
};

export const QUIZ_LENGTH = 10;

/** Filters questions by mode, shuffles them and keeps at most `limit`. */
export function selectQuestions(
  all: QuizQuestion[],
  mode: QuizMode,
  limit = QUIZ_LENGTH,
  random: () => number = Math.random,
): QuizQuestion[] {
  const pool = all.filter((q) => (mode === "mixed" ? true : q.kind === mode));
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr.slice(0, limit);
}

export function scorePercent(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((score / total) * 100);
}