import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Image as ImageIcon, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyContent } from "@/components/vet/EmptyContent";
import { Skeleton } from "@/components/ui/skeleton";

type PendingQuestion = {
  id: string;
  kind: "text" | "image";
  prompt: string;
  image_url: string | null;
  options: string[];
  correct_index: number;
  explanation: string;
  source_ref: string | null;
  topic_id: string;
  topics?: { name?: string | null; disciplines?: { name?: string | null } | null } | null;
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Revisão de questões — VetStudy" },
      { name: "description", content: "Revise e aprove questões antes de publicá-las aos estudantes." },
    ],
  }),
  component: AdminReviewPage,
});

function AdminReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  const roleQuery = useQuery({
    queryKey: ["admin-role", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some((row) => row.role === "admin");
    },
  });

  const questionsQuery = useQuery({
    queryKey: ["questions-pending-review"],
    enabled: Boolean(user) && roleQuery.data === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, kind, prompt, image_url, options, correct_index, explanation, source_ref, topic_id, topics(name, disciplines(name))")
        .eq("review_status", "pending")
        .order("created_at", { ascending: true })
        .limit(250);
      if (error) throw error;
      return (data ?? []) as unknown as PendingQuestion[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("questions")
        .update({ review_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["questions-pending-review"] });
      await queryClient.invalidateQueries({ queryKey: ["disciplines"] });
      await queryClient.invalidateQueries({ queryKey: ["discipline"] });
    },
  });

  const questions = questionsQuery.data ?? [];
  const visible = useMemo(
    () => filter === "all" ? questions : questions.filter((q) => q.kind === filter),
    [filter, questions],
  );

  if (authLoading || (user && roleQuery.isLoading)) {
    return <main className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-48 rounded-2xl" /></main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-3xl font-semibold">Área de revisão</h1>
        <p className="mt-2 text-muted-foreground">Entre na sua conta de administradora para revisar as questões.</p>
        <Button asChild className="mt-6"><Link to="/auth">Entrar</Link></Button>
      </main>
    );
  }

  if (roleQuery.isError) {
    return <main className="mx-auto max-w-3xl px-4 py-12"><EmptyContent text="Não foi possível verificar sua permissão. Tente novamente mais tarde." /></main>;
  }

  if (roleQuery.data !== true) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-3xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground">Sua conta ainda não tem a função de administradora para revisar questões.</p>
        <Button asChild variant="outline" className="mt-6"><Link to="/">Voltar às disciplinas</Link></Button>
      </main>
    );
  }

  if (questionsQuery.isLoading) {
    return <main className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-64 rounded-2xl" /></main>;
  }

  if (questionsQuery.isError) {
    return <main className="mx-auto max-w-5xl px-4 py-10"><EmptyContent text="Não foi possível carregar as questões pendentes. Verifique as permissões do Supabase e tente novamente." /></main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Painel administrativo</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Revisão de questões</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Confira enunciado, figura, alternativas, gabarito e explicação. Só aprove o que estiver de acordo com o material de aula.
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm">{questions.length} pendentes</Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todas</Button>
        <Button size="sm" variant={filter === "text" ? "default" : "outline"} onClick={() => setFilter("text")}>Tradicionais</Button>
        <Button size="sm" variant={filter === "image" ? "default" : "outline"} onClick={() => setFilter("image")}>Com imagem</Button>
      </div>

      {visible.length === 0 ? (
        <div className="mt-8"><EmptyContent text="Não há questões pendentes neste filtro." /></div>
      ) : (
        <div className="mt-6 space-y-5">
          {visible.map((q, index) => {
            const options = Array.isArray(q.options) ? q.options : [];
            const busy = reviewMutation.isPending && reviewMutation.variables?.id === q.id;
            return (
              <article key={q.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{q.kind === "image" ? "Questão visual" : "Questão tradicional"}</Badge>
                    {q.topics?.disciplines?.name && <span className="text-sm text-muted-foreground">{q.topics.disciplines.name}</span>}
                    {q.topics?.name && <span className="text-sm text-muted-foreground">· {q.topics.name}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">#{index + 1}</span>
                </div>

                <h2 className="mt-4 text-lg font-semibold">{q.prompt}</h2>
                {q.image_url && (
                  <a href={q.image_url} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-muted p-2" title="Abrir figura em tamanho completo">
                    <img src={q.image_url} alt="Figura de referência da questão" className="mx-auto max-h-80 w-full object-contain" loading="lazy" />
                    <span className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Abrir figura em tamanho completo</span>
                  </a>
                )}

                <ol className="mt-4 space-y-2">
                  {options.map((option, i) => (
                    <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${i === q.correct_index ? "border-success bg-success-soft font-medium" : "border-border"}`}>
                      <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}.</span>{option}
                      {i === q.correct_index && <span className="ml-2 text-xs text-success">Gabarito indicado</span>}
                    </li>
                  ))}
                </ol>

                <div className="mt-4 rounded-xl bg-secondary/60 p-4">
                  <p className="text-sm font-semibold">Explicação</p>
                  <p className="mt-1 text-sm">{q.explanation}</p>
                  {q.source_ref && <p className="mt-3 text-xs text-muted-foreground">Referência: {q.source_ref}</p>}
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: q.id, status: "rejected" })}>
                    <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                  </Button>
                  <Button size="sm" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: q.id, status: "approved" })}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> {busy ? "Salvando..." : "Aprovar questão"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
