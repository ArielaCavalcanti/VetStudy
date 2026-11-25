import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Mascot } from "@/components/vet/Mascot";
import { EmptyContent } from "@/components/vet/EmptyContent";
import { MODE_LABELS, selectQuestions, scorePercent, type QuizMode, type QuizQuestion } from "@/lib/quiz";
import { cn } from "@/lib/utils";

interface QuizSearch { mode: QuizMode; topic?: string | undefined; discipline?: string | undefined }

export const Route = createFileRoute("/quiz")({
  validateSearch: (s: Record<string, unknown>): QuizSearch => {
    const mode = s["mode"] === "text" || s["mode"] === "image" ? s["mode"] : "mixed";
    const out: QuizSearch = { mode };
    if (typeof s["topic"] === "string") out.topic = s["topic"];
    if (typeof s["discipline"] === "string") out.discipline = s["discipline"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Quiz — VetStudy" },
      { name: "description", content: "Responda questões de anatomia veterinária com explicação imediata." },
      { property: "og:title", content: "Quiz — VetStudy" },
      { property: "og:description", content: "Responda questões de anatomia veterinária com explicação imediata." },
    ],
  }),
  ssr: false,
  component: QuizPage,
});

type Answer = { question_id: string; chosen: number; correct: boolean };

function QuizPage() {
  const { mode, topic, discipline } = Route.useSearch();
  const { user } = useAuth();
  const [seed, setSeed] = useState(0);

  const { data: questions, isLoading } = useQuery({
    queryKey: ["quiz", mode, topic, discipline, seed],
    staleTime: Infinity,
    queryFn: async () => {
      let q = supabase.from("questions").select("id, kind, prompt, image_url, options, correct_index, explanation, source_ref, topics!inner(discipline_id)");
      if (topic) q = q.eq("topic_id", topic);
      else if (discipline) q = q.eq("topics.discipline_id", discipline);
      if (mode !== "mixed") q = q.eq("kind", mode);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => ({ ...r, options: r.options as string[] })) as QuizQuestion[];
      return selectQuestions(rows, mode);
    },
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const saved = useRef(false);

  const total = questions?.length ?? 0;
  const finished = total > 0 && answers.length === total && chosen === null;
  const score = answers.filter((a) => a.correct).length;

  useEffect(() => {
    if (!finished || !user || saved.current) return;
    saved.current = true;
    void supabase.from("quiz_attempts").insert({
      user_id: user.id, topic_id: topic ?? null, mode, score, total, answers,
    });
  }, [finished, user, topic, mode, score, total, answers]);

  const restart = () => { setIdx(0); setAnswers([]); setChosen(null); saved.current = false; setSeed((s) => s + 1); };

  if (isLoading) return <div className="mx-auto max-w-2xl p-4 py-10"><Skeleton className="h-96 rounded-2xl" /></div>;
  if (!questions || total === 0) return <div className="mx-auto max-w-2xl p-4 py-10"><EmptyContent text="Ainda não há questões para este quiz." /></div>;

  if (finished) {
    const pct = scorePercent(score, total);
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 text-center">
        <Mascot className="mx-auto h-32 w-32 animate-bob" mood={pct >= 60 ? "happy" : "sad"} />
        <h1 className="mt-4 text-3xl font-semibold">{pct >= 60 ? "Mandou bem!" : "Continue praticando!"}</h1>
        <p className="mt-2 text-lg text-muted-foreground">Você acertou {score} de {total} ({pct}%).</p>
        {!user && <p className="mt-3 text-sm text-muted-foreground"><Link to="/auth" className="text-primary underline">Entre</Link> para salvar seu histórico.</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={restart}>Refazer quiz</Button>
          <Button variant="outline" asChild><Link to="/">Outras disciplinas</Link></Button>
        </div>
      </main>
    );
  }

  const q = questions[idx]!;
  const answered = chosen !== null;

  const choose = (i: number) => {
    if (answered) return;
    setChosen(i);
    setAnswers((a) => [...a, { question_id: q.id, chosen: i, correct: i === q.correct_index }]);
  };
  const next = () => { setChosen(null); if (idx + 1 < total) setIdx(idx + 1); };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{MODE_LABELS[mode]}</span>
        <span>Questão {idx + 1} de {total}</span>
      </div>
      <Progress value={((idx + (answered ? 1 : 0)) / total) * 100} className="mb-6" />
      <article className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7">
        {q.kind === "image" && q.image_url && (
          <img src={q.image_url} alt="Imagem da questão" className="mb-5 max-h-80 w-full rounded-xl bg-muted object-contain" />
        )}
        <h1 className="text-xl font-semibold sm:text-2xl">{q.prompt}</h1>
        <div className="mt-5 space-y-2">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct_index;
            const isChosen = i === chosen;
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={answered}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 border-border bg-background px-4 py-3 text-left transition",
                  !answered && "hover:border-primary",
                  answered && isCorrect && "border-success bg-success-soft",
                  answered && isChosen && !isCorrect && "border-destructive bg-destructive-soft",
                  answered && !isCorrect && !isChosen && "opacity-60",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={cn("mt-5 flex gap-3 rounded-xl p-4", chosen === q.correct_index ? "bg-success-soft" : "bg-destructive-soft")}>
            <Mascot className="h-14 w-14 shrink-0" mood={chosen === q.correct_index ? "happy" : "sad"} />
            <div>
              <p className="font-semibold">{chosen === q.correct_index ? "Correto!" : "Não foi dessa vez."}</p>
              <p className="mt-1 text-sm">{q.explanation}</p>
              {q.source_ref && <p className="mt-2 text-xs text-muted-foreground">Fonte: {q.source_ref}</p>}
            </div>
          </div>
        )}
        {answered && (
          <div className="mt-5 flex justify-end">
            <Button onClick={next}>{idx + 1 < total ? "Próxima" : "Ver resultado"}</Button>
          </div>
        )}
      </article>
    </main>
  );
}