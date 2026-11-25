import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, CheckCircle2, FileText, LoaderCircle, Sparkles, Upload, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { EmptyContent } from "@/components/vet/EmptyContent";
import { Skeleton } from "@/components/ui/skeleton";
import { generateStudyFromDocument } from "@/lib/study-materials.functions";

export const Route = createFileRoute("/materiais")({
  head: () => ({
    meta: [
      { title: "Materiais de estudo — VetStudy" },
      { name: "description", content: "Envie documentos de aula e gere resumos e quizzes para revisão." },
    ],
  }),
  component: StudyMaterialsPage,
});

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".ppt", ".pptx", ".doc", ".docx", ".txt", ".md"];

function detectMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  const mime: Record<string, string> = {
    ".pdf": "application/pdf",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".md": "text/markdown",
  };
  return mime[extension] ?? "application/octet-stream";
}

function StudyMaterialsPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [disciplineId, setDisciplineId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  const roleQuery = useQuery({
    queryKey: ["admin-role", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some((row) => row.role === "admin");
    },
  });

  const disciplinesQuery = useQuery({
    queryKey: ["material-disciplines"],
    enabled: roleQuery.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("disciplines").select("id,name").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const topicsQuery = useQuery({
    queryKey: ["material-topics"],
    enabled: roleQuery.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("topics").select("id,name,discipline_id").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["study-documents"],
    enabled: roleQuery.data === true,
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from("study_documents")
        .select("id,title,original_filename,status,error_message,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const documentIds = (documentsQuery.data ?? []).map((doc: any) => doc.id);
  const summariesQuery = useQuery({
    queryKey: ["study-summaries-admin", documentIds.join(",")],
    enabled: roleQuery.data === true && documentsQuery.isSuccess && documentIds.length > 0,
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from("study_summaries")
        .select("id,document_id,title,content_markdown,review_status,reviewer_note,created_at")
        .in("document_id", documentIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredTopics = useMemo(
    () => (topicsQuery.data ?? []).filter((topic) => topic.discipline_id === disciplineId),
    [topicsQuery.data, disciplineId],
  );

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre com sua conta de administradora.");
      if (!file) throw new Error("Selecione um arquivo para enviar.");
      if (file.size > MAX_FILE_SIZE) throw new Error("O arquivo ultrapassa o limite de 25 MB.");
      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!ACCEPTED_EXTENSIONS.includes(extension)) throw new Error("Formato não aceito. Use PDF, PowerPoint, Word, TXT ou Markdown.");
      if (!disciplineId || !topicId) throw new Error("Selecione a disciplina e o tópico do material.");

      const cleanName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
      const storagePath = `${user.id}/${crypto.randomUUID()}-${cleanName}`;
      const mimeType = detectMimeType(file);
      const { error: storageError } = await supabase.storage
        .from("study-materials")
        .upload(storagePath, file, { contentType: mimeType, upsert: false });

      if (storageError) throw new Error(storageError.message);

      const db = supabase as any;
      const { data, error } = await db.from("study_documents").insert({
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        original_filename: file.name,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size_bytes: file.size,
        discipline_id: disciplineId,
        topic_id: topicId,
        uploaded_by: user.id,
        status: "uploaded",
      }).select("id").single();

      if (error) {
        await supabase.storage.from("study-materials").remove([storagePath]);
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: async () => {
      setFile(null);
      setTitle("");
      setFormError("");
      await queryClient.invalidateQueries({ queryKey: ["study-documents"] });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Não foi possível enviar o material."),
  });

  const generateMutation = useMutation({
    mutationFn: (documentId: string) => generateStudyFromDocument({ data: { documentId } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["study-documents"] });
      await queryClient.invalidateQueries({ queryKey: ["study-summaries-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["questions-pending-review"] });
      window.alert(`Resumo gerado: ${result.summaryTitle}. ${result.generatedQuestions} questões criadas para revisão.`);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ summaryId, status }: { summaryId: string; status: "approved" | "rejected" }) => {
      const db = supabase as any;
      const { error } = await db.from("study_summaries").update({
        review_status: status,
        updated_at: new Date().toISOString(),
      }).eq("id", summaryId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["study-summaries-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["approved-study-summaries"] });
    },
  });

  if (authLoading || (user && roleQuery.isLoading)) {
    return <main className="mx-auto max-w-5xl px-4 py-10"><Skeleton className="h-72 rounded-2xl" /></main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <FileText className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-3xl font-semibold">Biblioteca de materiais</h1>
        <p className="mt-2 text-muted-foreground">Entre como administradora para enviar e organizar os materiais.</p>
        <Button asChild className="mt-6"><Link to="/auth">Entrar</Link></Button>
      </main>
    );
  }

  if (roleQuery.isError) {
    return <main className="mx-auto max-w-3xl px-4 py-12"><EmptyContent text="Não foi possível verificar sua permissão. Tente novamente." /></main>;
  }

  if (roleQuery.data !== true) {
    return <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
      <h1 className="mt-4 text-3xl font-semibold">Acesso restrito</h1>
      <p className="mt-2 text-muted-foreground">Somente administradores podem enviar materiais de aula.</p>
      <Button asChild variant="outline" className="mt-6"><Link to="/">Voltar às disciplinas</Link></Button>
    </main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Área administrativa</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Materiais de estudo</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Envie um material da aula para criar um resumo e questões baseadas no próprio documento.
          </p>
        </div>
        <Button asChild variant="outline"><Link to="/admin">Revisar questões</Link></Button>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><Upload className="h-5 w-5" /></div>
          <div>
            <h2 className="text-xl font-semibold">Adicionar novo material</h2>
            <p className="text-sm text-muted-foreground">PDF, PowerPoint, Word, TXT ou Markdown · até 25 MB</p>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={(event) => { event.preventDefault(); setFormError(""); uploadMutation.mutate(); }}>
          <label className="grid gap-2 text-sm font-medium">
            Nome do material
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Sistema cardiovascular — aula 2" className="h-11 rounded-lg border border-input bg-background px-3 font-normal" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Disciplina
              <select value={disciplineId} onChange={(event) => { setDisciplineId(event.target.value); setTopicId(""); }} className="h-11 rounded-lg border border-input bg-background px-3 font-normal">
                <option value="">Selecione uma disciplina</option>
                {(disciplinesQuery.data ?? []).map((discipline) => <option key={discipline.id} value={discipline.id}>{discipline.name}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Tópico
              <select value={topicId} onChange={(event) => setTopicId(event.target.value)} disabled={!disciplineId} className="h-11 rounded-lg border border-input bg-background px-3 font-normal disabled:opacity-50">
                <option value="">Selecione um tópico</option>
                {filteredTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Arquivo
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md"
              onChange={(event) => { setFile(event.target.files?.[0] ?? null); setFormError(""); }}
              className="block w-full rounded-lg border border-dashed border-input bg-background p-3 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-medium"
            />
          </label>

          {file && <p className="text-sm text-muted-foreground">Selecionado: {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</p>}
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          {uploadMutation.isError && <p role="alert" className="text-sm text-destructive">{uploadMutation.error.message}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={uploadMutation.isPending || !file || !topicId}>
              {uploadMutation.isPending ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : <><Upload className="mr-2 h-4 w-4" /> Enviar material</>}
            </Button>
            <span className="text-xs text-muted-foreground">O arquivo ficará privado, acessível apenas à administração.</span>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Materiais enviados</h2>
            <p className="text-sm text-muted-foreground">Gere resumos e questões quando a IA estiver configurada.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-sm">{documentsQuery.data?.length ?? 0} arquivos</span>
        </div>

        {documentsQuery.isLoading ? (
          <div className="mt-5"><Skeleton className="h-36 rounded-xl" /></div>
        ) : documentsQuery.isError ? (
          <div className="mt-5"><EmptyContent text="Não foi possível carregar os materiais. Confira se o SQL de configuração já foi executado no Supabase." /></div>
        ) : !documentsQuery.data?.length ? (
          <div className="mt-5"><EmptyContent text="Nenhum material enviado ainda. O primeiro PDF ou apresentação pode entrar por aqui." /></div>
        ) : (
          <div className="mt-5 space-y-4">
            {documentsQuery.data.map((doc: any) => {
              const summary = (summariesQuery.data ?? []).find((item: any) => item.document_id === doc.id);
              const busy = generateMutation.isPending && generateMutation.variables === doc.id;
              return (
                <article key={doc.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-xl bg-secondary p-3"><FileText className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">{doc.title}</h3>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{doc.original_filename}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                      {doc.status === "ready" ? "Processado" : doc.status === "processing" ? "Em análise" : doc.status === "failed" ? "Falhou" : "Enviado"}
                    </span>
                  </div>

                  {doc.error_message && <p role="alert" className="mt-3 text-sm text-destructive">{doc.error_message}</p>}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => generateMutation.mutate(doc.id)} disabled={busy || generateMutation.isPending || doc.status === "processing"}>
                      {busy ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Gerar resumo + quiz</>}
                    </Button>
                  </div>

                  {generateMutation.isError && generateMutation.variables === doc.id && (
                    <p role="alert" className="mt-3 text-sm text-destructive">{generateMutation.error.message}</p>
                  )}

                  {summary && (
                    <div className="mt-5 rounded-xl bg-secondary/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-semibold">{summary.title}</h4>
                        <span className="text-xs font-medium text-muted-foreground">
                          {summary.review_status === "approved" ? "Resumo aprovado" : summary.review_status === "rejected" ? "Resumo recusado" : "Aguardando revisão"}
                        </span>
                      </div>
                      <div className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-6">{summary.content_markdown}</div>
                      {summary.review_status === "pending" && (
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ summaryId: summary.id, status: "rejected" })}>
                            <XCircle className="mr-2 h-4 w-4" /> Recusar resumo
                          </Button>
                          <Button size="sm" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ summaryId: summary.id, status: "approved" })}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar resumo
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-8 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground"><BookOpen className="h-4 w-4" /> Como funciona a revisão</p>
        <p className="mt-2">Os resumos enviados para aprovação aparecem na área de resumos dos estudantes somente depois de aprovados. As questões geradas entram na fila de revisão administrativa e continuam ocultas até serem aprovadas.</p>
      </div>
    </main>
  );
}
