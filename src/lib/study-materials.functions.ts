import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const generatedQuestionSchema = z.object({
  prompt: z.string().min(8),
  options: z.array(z.string().min(1)).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().min(8),
  source_location: z.string(),
});

const generatedStudySchema = z.object({
  summary_title: z.string().min(3),
  summary_markdown: z.string().min(80),
  questions: z.array(generatedQuestionSchema).max(8),
});

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary_title: { type: "string" },
    summary_markdown: { type: "string" },
    questions: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          correct_index: { type: "integer" },
          explanation: { type: "string" },
          source_location: { type: "string" },
        },
        required: ["prompt", "options", "correct_index", "explanation", "source_location"],
      },
    },
  },
  required: ["summary_title", "summary_markdown", "questions"],
};

function extractOutputText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const pieces: string[] = [];
  for (const item of response?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        pieces.push(content.text);
      }
      if (content?.type === "refusal") {
        throw new Error("A IA não conseguiu processar este material. Tente outro arquivo.");
      }
    }
  }
  return pieces.join("\n").trim();
}

export const generateStudyFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ documentId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const db = ctx.supabase;
    const userId = ctx.userId;

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new Error("A geração por IA ainda não foi configurada. Falta adicionar OPENAI_API_KEY como segredo do servidor.");
    }

    const { data: roles, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roleError || !Array.isArray(roles) || !roles.some((row: { role: string }) => row.role === "admin")) {
      throw new Error("Apenas administradores podem gerar materiais de estudo.");
    }

    const { data: document, error: documentError } = await db
      .from("study_documents")
      .select("id, title, original_filename, storage_path, mime_type, topic_id, discipline_id")
      .eq("id", data.documentId)
      .single();

    if (documentError || !document) {
      throw new Error("Não foi possível localizar o documento selecionado.");
    }

    const supportedTypes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
    ]);
    if (!supportedTypes.has(document.mime_type)) {
      throw new Error("Formato não suportado. Envie PDF, PowerPoint, Word, TXT ou Markdown.");
    }

    const { data: topic, error: topicError } = await db
      .from("topics")
      .select("name, disciplines(name)")
      .eq("id", document.topic_id)
      .single();

    if (topicError || !topic) {
      throw new Error("O tópico vinculado ao documento não foi encontrado.");
    }

    const { data: signed, error: signedError } = await db.storage
      .from("study-materials")
      .createSignedUrl(document.storage_path, 600);

    if (signedError || !signed?.signedUrl) {
      throw new Error("Não foi possível abrir o arquivo para análise. Verifique o armazenamento do Supabase.");
    }

    await db
      .from("study_documents")
      .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", document.id);

    try {
      const prompt = [
        "Você é o assistente acadêmico do VetStudy, uma plataforma de anatomia veterinária.",
        "Use EXCLUSIVAMENTE o conteúdo do arquivo anexado. Não complemente com conhecimento externo, não invente estruturas, definições, relações, valores, espécies, páginas ou referências.",
        "Se o documento estiver incompleto, ilegível ou não trouxer conteúdo suficiente, diga isso no resumo e gere menos questões (inclusive zero), nunca invente.",
        "Produza um resumo didático em português do Brasil, organizado com títulos, subtítulos, tópicos e tabelas Markdown quando forem úteis. Preserve a terminologia, a organização e o nível de detalhe da fonte.",
        "Registre referências de página ou slide apenas quando estiverem visíveis/identificáveis no arquivo. Não invente números de página.",
        "Crie até 8 questões objetivas de múltipla escolha. Cada questão deve ter exatamente 4 alternativas distintas, uma única resposta correta, índice correto de 0 a 3 e explicação baseada no próprio arquivo.",
        "As alternativas incorretas devem ser plausíveis, mas claramente incorretas segundo o arquivo. Não use pegadinhas ou informação externa.",
        "Em source_location, escreva página/slide/parte identificável, ou string vazia quando a fonte não permitir localizar.",
        "O resumo e as questões serão revisados por uma professora antes de serem liberados aos estudantes.",
        "",
        "DISCIPLINA: " + (topic.disciplines?.name ?? "Não identificada"),
        "TÓPICO: " + topic.name,
        "NOME DO MATERIAL: " + document.title,
        "ARQUIVO ORIGINAL: " + document.original_filename,
      ].join("\n");

      const model = process.env["OPENAI_MODEL"] || "gpt-6.2-astra";
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_output_tokens: 12000,
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_file", file_url: signed.signedUrl },
            ],
          }],
          text: {
            format: {
              type: "json_schema",
              name: "vetstudy_study_material",
              strict: true,
              schema: responseJsonSchema,
            },
          },
        }),
      });

      const apiResult = await response.json() as any;
      if (!response.ok) {
        const message = apiResult?.error?.message || `A API de IA retornou erro HTTP ${response.status}.`;
        throw new Error(message);
      }
      if (apiResult?.status === "incomplete") {
        throw new Error("A análise do documento ficou incompleta. Tente um arquivo menor ou divida o material.");
      }

      const rawText = extractOutputText(apiResult);
      if (!rawText) {
        throw new Error("A IA não retornou um resultado legível para este documento.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error("A resposta da IA não veio no formato esperado. Tente gerar novamente.");
      }
      const generated = generatedStudySchema.parse(parsed);

      const { error: summaryError } = await db
        .from("study_summaries")
        .upsert({
          document_id: document.id,
          topic_id: document.topic_id,
          title: generated.summary_title,
          content_markdown: generated.summary_markdown,
          review_status: "pending",
          reviewer_note: null,
          created_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "document_id" });

      if (summaryError) throw new Error("O resumo foi gerado, mas não pôde ser salvo: " + summaryError.message);

      if (generated.questions.length > 0) {
        const questionRows = generated.questions.map((question) => ({
          topic_id: document.topic_id,
          kind: "text",
          prompt: question.prompt,
          image_url: null,
          options: question.options,
          correct_index: question.correct_index,
          explanation: question.explanation,
          source_ref: question.source_location
            ? `${document.original_filename} · ${question.source_location}`
            : document.original_filename,
          review_status: "pending",
          study_document_id: document.id,
        }));

        const { error: questionError } = await db
          .from("questions")
          .upsert(questionRows, { onConflict: "topic_id,prompt", ignoreDuplicates: true });
        if (questionError) {
          throw new Error("O resumo foi salvo, mas as questões não puderam ser salvas: " + questionError.message);
        }
      }

      await db
        .from("study_documents")
        .update({ status: "ready", error_message: null, updated_at: new Date().toISOString() })
        .eq("id", document.id);

      return {
        success: true,
        summaryTitle: generated.summary_title,
        generatedQuestions: generated.questions.length,
        reviewStatus: "pending" as const,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao analisar o documento.";
      await db
        .from("study_documents")
        .update({ status: "failed", error_message: message.slice(0, 500), updated_at: new Date().toISOString() })
        .eq("id", document.id);
      throw new Error(message);
    }
  });
