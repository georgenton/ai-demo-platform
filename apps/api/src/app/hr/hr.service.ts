// -----------------------------------------------------------------------------
// HrService — orquestador del Demo 07 (avatar entrevistador HR).
//
// Cinco responsabilidades:
//   1) Listar roles disponibles (tenant compartido `hr-shared`).
//   2) Obtener un rol con su primera pregunta (sin exponer rúbricas).
//   3) Crear una nueva Interview en el tenant del reclutador.
//   4) Servir la siguiente pregunta no respondida o cerrar la entrevista.
//   5) Persistir respuestas (upsert por questionId).
//   6) Stream del scoring final con tool calling.
//
// Resolver de tenant — el catálogo de Jobs vive en un tenant especial
// `hr-shared` (decisión 2A del ADR-0017). Las Interviews viven en el tenant
// del reclutador real. El resolver es trivial pero queda aislado para que
// el día que una empresa firme contrato y quiera sus roles propios, solo
// se toque ese método (mismo patrón que el clinical).
//
// Bypass del superadmin: para QA sin tener que cambiar de tenant, igual
// que en el demo clínico.
// -----------------------------------------------------------------------------

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { prisma } from '@org/db';
import { chat } from '@org/llm-adapter';
import type {
  ChatRichMessage,
  ChatTool,
  TextBlock,
  ToolUseBlock,
} from '@org/llm-adapter';

import type {
  HrDimensionScoredEvent,
  HrEvent,
  HrFinalEvent,
} from './hr-events.js';
import type { AnswerQuestionDto } from './dto/answer-question.dto.js';
import type { CreateInterviewDto } from './dto/create-interview.dto.js';

/**
 * Tenant compartido del seed. Cualquier reclutador resuelve a este tenant
 * para *leer el catálogo de Jobs*. Las Interviews que crea viven en su
 * propio tenant.
 */
const SHARED_JOBS_TENANT_ID = 'ctnt_hr_shared';

/** Tope del loop de tool calling. Más que esto = LLM confundido. */
const MAX_TURNS = 8;

/** Tope de transcripción que se manda al LLM. Defensa contra prompt enorme. */
const MAX_TRANSCRIPT_CHARS_PER_ANSWER = 4000;

/** Definición de los tools que el LLM puede invocar al finalizar. */
const SCORE_DIMENSION_TOOL: ChatTool = {
  name: 'score_dimension',
  description:
    'Emite el puntaje (0-100) y la evidencia para una de las dimensiones a evaluar. ' +
    'Llamar UNA VEZ por dimensión, en el orden listado en el system prompt. ' +
    '`evidence` debe ser una cita textual corta (1 línea) de la respuesta del candidato.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Nombre exacto de la dimensión a evaluar (espejo del input).',
      },
      score: {
        type: 'integer',
        description: 'Score 0 a 100.',
      },
      evidence: {
        type: 'string',
        description:
          'Cita textual corta (~1 línea) de la respuesta del candidato que justifica el score.',
      },
    },
    required: ['name', 'score', 'evidence'],
  },
};

const FINAL_RECOMMENDATION_TOOL: ChatTool = {
  name: 'final_recommendation',
  description:
    'Emite la recomendación final de la entrevista. Llamar UNA VEZ, después de ' +
    'haber emitido todas las dimensiones con score_dimension.',
  inputSchema: {
    type: 'object',
    properties: {
      overall: {
        type: 'integer',
        description: 'Score global 0-100 (no necesariamente promedio simple).',
      },
      recommendation: {
        type: 'string',
        enum: ['hire', 'reconsider', 'reject'],
        description:
          '"hire" = pasar a siguiente etapa; "reconsider" = vale otra mirada; "reject" = no recomendar.',
      },
      strengths: {
        type: 'string',
        description: 'Párrafo (2-3 oraciones) con las fortalezas observadas.',
      },
      opportunities: {
        type: 'string',
        description:
          'Párrafo (2-3 oraciones) con áreas a profundizar / oportunidades de mejora.',
      },
    },
    required: ['overall', 'recommendation', 'strengths', 'opportunities'],
  },
};

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  // ---------------------------------------------------------------------------
  // Resolvers de tenant
  // ---------------------------------------------------------------------------

  /**
   * Tenant contra el cual buscar Jobs y JobQuestions. Hoy siempre el
   * compartido. Aislado para no acoplar el catálogo al userTenantId.
   */
  private resolveJobsTenantId(): string {
    return SHARED_JOBS_TENANT_ID;
  }

  // ---------------------------------------------------------------------------
  // Catálogo
  // ---------------------------------------------------------------------------

  /**
   * Lista de roles disponibles para el demo. Solo metadata pública —
   * no exponemos la rúbrica de las preguntas (eso es input del LLM, no
   * material para el candidato).
   */
  async listJobs() {
    const tenantId = this.resolveJobsTenantId();
    const jobs = await prisma.job.findMany({
      where: { tenantId },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        dimensions: true,
        _count: { select: { questions: true } },
      },
    });
    return { items: jobs, total: jobs.length };
  }

  /**
   * Detalle del rol. Devuelve dimensiones + cantidad de preguntas. Las
   * preguntas se sirven una por una via /next-question — el candidato nunca
   * ve la lista completa de antemano (evita que prepare respuestas robóticas).
   */
  async getJob(jobId: string) {
    const tenantId = this.resolveJobsTenantId();
    const job = await prisma.job.findFirst({
      where: { id: jobId, tenantId },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        dimensions: true,
        _count: { select: { questions: true } },
      },
    });
    if (!job) throw new NotFoundException(`Job ${jobId} no existe.`);
    return job;
  }

  // ---------------------------------------------------------------------------
  // Entrevistas
  // ---------------------------------------------------------------------------

  /**
   * Crea una Interview con status `in_progress` y devuelve la primera
   * pregunta. El reclutador puede arrancar la sesión de inmediato sin un
   * round-trip adicional.
   *
   * La Interview vive en `recruiterTenantId` (el tenant del usuario logueado),
   * NO en el tenant de los Jobs — los datos del candidato son del cliente,
   * no del catálogo del demo.
   */
  async createInterview(recruiterTenantId: string, dto: CreateInterviewDto) {
    // Verificamos que el Job exista en el tenant de catálogo.
    const job = await this.getJob(dto.jobId);

    const interview = await prisma.interview.create({
      data: {
        tenantId: recruiterTenantId,
        jobId: job.id,
        candidateName: dto.candidateName,
        candidateExternalId: dto.candidateExternalId ?? null,
        status: 'in_progress',
      },
    });

    // Sirve la primera pregunta en el mismo response.
    const firstQuestion = await prisma.jobQuestion.findFirst({
      where: { jobId: job.id },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, text: true },
    });
    if (!firstQuestion) {
      throw new BadRequestException(
        `El rol "${job.title}" no tiene preguntas configuradas.`,
      );
    }

    this.logger.log(
      `interview created → id=${interview.id} job=${job.slug} tenant=${recruiterTenantId}`,
    );

    return {
      interviewId: interview.id,
      jobTitle: job.title,
      totalQuestions: job._count.questions,
      currentQuestion: firstQuestion,
    };
  }

  /**
   * Devuelve la siguiente pregunta NO respondida (orden ascendente) o un
   * marker `done` si todas tienen respuesta. El frontend usa esto entre
   * respuesta y respuesta.
   *
   * Validamos que la interview pertenezca al tenant del reclutador (no se
   * puede atajar una entrevista de otro tenant aunque conozcas el id).
   */
  async getNextQuestion(recruiterTenantId: string, interviewId: string) {
    const interview = await this.loadInterviewOrThrow(
      recruiterTenantId,
      interviewId,
    );

    if (interview.status !== 'in_progress') {
      throw new BadRequestException(
        `La entrevista ya está cerrada (status: ${interview.status}).`,
      );
    }

    const answeredQuestionIds = new Set(
      interview.answers.map((a) => a.questionId),
    );
    const nextQuestion = await prisma.jobQuestion.findFirst({
      where: {
        jobId: interview.jobId,
        id: { notIn: [...answeredQuestionIds] },
      },
      orderBy: { order: 'asc' },
      select: { id: true, order: true, text: true },
    });

    if (!nextQuestion) {
      return {
        done: true as const,
        answeredCount: answeredQuestionIds.size,
      };
    }
    return {
      done: false as const,
      currentQuestion: nextQuestion,
      answeredCount: answeredQuestionIds.size,
    };
  }

  /**
   * Persiste la respuesta del candidato. Upsert por `(interviewId, questionId)`
   * — si el candidato re-grabó antes de confirmar, pisa la anterior. Validamos
   * que la pregunta pertenezca al Job de la entrevista (defensa contra IDs
   * inventados desde el frontend).
   */
  async recordAnswer(
    recruiterTenantId: string,
    interviewId: string,
    dto: AnswerQuestionDto,
  ) {
    const interview = await this.loadInterviewOrThrow(
      recruiterTenantId,
      interviewId,
    );
    if (interview.status !== 'in_progress') {
      throw new BadRequestException(
        `La entrevista ya está cerrada (status: ${interview.status}).`,
      );
    }

    const question = await prisma.jobQuestion.findUnique({
      where: { id: dto.questionId },
      select: { id: true, jobId: true },
    });
    if (!question || question.jobId !== interview.jobId) {
      throw new BadRequestException(
        'La pregunta no pertenece al rol de esta entrevista.',
      );
    }

    await prisma.interviewAnswer.upsert({
      where: {
        interviewId_questionId: {
          interviewId,
          questionId: dto.questionId,
        },
      },
      update: {
        transcript: dto.transcript,
        durationSeconds: dto.durationSeconds ?? null,
      },
      create: {
        interviewId,
        questionId: dto.questionId,
        transcript: dto.transcript,
        durationSeconds: dto.durationSeconds ?? null,
      },
    });

    return { ok: true as const };
  }

  // ---------------------------------------------------------------------------
  // Finalize — stream del scoring con tool calling
  // ---------------------------------------------------------------------------

  /**
   * Genera el scoring final con el LLM y emite eventos SSE incrementales
   * (uno por dimensión + uno final). Persiste `scoring` y marca la
   * entrevista como `finalized` al cierre.
   *
   * Si el LLM se confunde y no completa todas las dimensiones, persistimos
   * lo que llegó y marcamos `abandoned` para que el reclutador vea el caso
   * en lugar de bloquearse.
   */
  async *streamFinalize(
    recruiterTenantId: string,
    interviewId: string,
  ): AsyncIterable<HrEvent> {
    const interview = await this.loadInterviewWithJobOrThrow(
      recruiterTenantId,
      interviewId,
    );
    if (interview.status === 'finalized') {
      throw new BadRequestException(
        'La entrevista ya fue finalizada previamente.',
      );
    }
    if (interview.answers.length === 0) {
      throw new BadRequestException(
        'La entrevista no tiene respuestas — no hay nada que evaluar.',
      );
    }

    this.logger.log(
      `finalize → interview=${interviewId} job=${interview.job.slug} answers=${interview.answers.length}`,
    );

    const messages: ChatRichMessage[] = [
      { role: 'system', content: buildScoringPrompt(interview) },
      {
        role: 'user',
        content:
          'Por favor procede con la evaluación: llama a score_dimension una vez por cada dimensión ' +
          'del rol (en el orden listado), y luego final_recommendation con el resumen.',
      },
    ];

    // Acumulamos las dimensiones emitidas para el `scoring` JSON final que
    // se persiste en la Interview. El LLM puede ocasionalmente repetir una
    // dimensión; nos quedamos con la última emisión.
    const dimensionsByName = new Map<string, HrDimensionScoredEvent>();
    let finalEvent: HrFinalEvent | null = null;
    let turns = 0;

    try {
      while (turns < MAX_TURNS) {
        turns++;
        const assistantBlocks: (TextBlock | ToolUseBlock)[] = [];
        const toolResults: {
          toolUseId: string;
          content: string;
          isError: boolean;
        }[] = [];
        let stopReason: string = 'other';

        for await (const event of chat.streamWithTools(messages, [
          SCORE_DIMENSION_TOOL,
          FINAL_RECOMMENDATION_TOOL,
        ])) {
          if (event.type === 'text_delta') {
            const last = assistantBlocks[assistantBlocks.length - 1];
            if (last && last.type === 'text') {
              last.text += event.text;
            } else {
              assistantBlocks.push({ type: 'text', text: event.text });
            }
            yield { type: 'token', text: event.text };
          } else if (event.type === 'tool_use_complete') {
            assistantBlocks.push({
              type: 'tool_use',
              id: event.id,
              name: event.name,
              input: event.input,
            });

            if (event.name === 'score_dimension') {
              const parsed = parseDimensionInput(event.input);
              if (parsed) {
                dimensionsByName.set(parsed.name, {
                  type: 'dimension_scored',
                  ...parsed,
                });
                yield { type: 'dimension_scored', ...parsed };
                toolResults.push({
                  toolUseId: event.id,
                  content: 'OK — dimensión registrada.',
                  isError: false,
                });
              } else {
                toolResults.push({
                  toolUseId: event.id,
                  content:
                    'Input inválido — name, score y evidence son obligatorios.',
                  isError: true,
                });
              }
            } else if (event.name === 'final_recommendation') {
              const parsed = parseFinalInput(event.input);
              if (parsed) {
                finalEvent = { type: 'final', ...parsed };
                yield finalEvent;
                toolResults.push({
                  toolUseId: event.id,
                  content: 'OK — recomendación registrada.',
                  isError: false,
                });
              } else {
                toolResults.push({
                  toolUseId: event.id,
                  content:
                    'Input inválido — overall, recommendation, strengths y opportunities son obligatorios.',
                  isError: true,
                });
              }
            } else {
              toolResults.push({
                toolUseId: event.id,
                content: `Tool desconocido: "${event.name}".`,
                isError: true,
              });
            }
          } else if (event.type === 'turn_end') {
            stopReason = event.stopReason;
          }
        }

        // Si el LLM no emitió bloques (raro), agregamos texto vacío para no
        // romper la alternancia que Anthropic exige.
        if (assistantBlocks.length === 0) {
          assistantBlocks.push({ type: 'text', text: '' });
        }
        messages.push({ role: 'assistant', content: assistantBlocks });

        if (stopReason === 'tool_use' && toolResults.length > 0) {
          messages.push({
            role: 'user',
            content: toolResults.map((tr) => ({
              type: 'tool_result' as const,
              toolUseId: tr.toolUseId,
              content: tr.content,
              isError: tr.isError,
            })),
          });
          continue;
        }

        // end_turn / max_tokens / other → cerramos.
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`finalize failed: ${message}`);
      yield { type: 'error_event', message };
      return;
    }

    // Persistimos el scoring + cerramos la entrevista. Si el LLM no emitió
    // el `final_recommendation` (loop truncado, max_tokens), guardamos lo
    // que llegó y marcamos `abandoned` para que el reclutador vea el caso.
    const persistedScoring = {
      dimensions: [...dimensionsByName.values()].map((d) => ({
        name: d.name,
        score: d.score,
        evidence: d.evidence,
      })),
      overall: finalEvent?.overall ?? null,
      recommendation: finalEvent?.recommendation ?? null,
      strengths: finalEvent?.strengths ?? null,
      opportunities: finalEvent?.opportunities ?? null,
    };
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: finalEvent ? 'finalized' : 'abandoned',
        finishedAt: new Date(),
        scoring: persistedScoring,
      },
    });

    yield { type: 'done', turns };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async loadInterviewOrThrow(
    recruiterTenantId: string,
    interviewId: string,
  ) {
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, tenantId: recruiterTenantId },
      include: {
        answers: { select: { questionId: true } },
      },
    });
    if (!interview) {
      throw new NotFoundException(
        `Entrevista ${interviewId} no existe en tu organización.`,
      );
    }
    return interview;
  }

  private async loadInterviewWithJobOrThrow(
    recruiterTenantId: string,
    interviewId: string,
  ) {
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, tenantId: recruiterTenantId },
      include: {
        job: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            dimensions: true,
            questions: { orderBy: { order: 'asc' } },
          },
        },
        answers: {
          orderBy: { answeredAt: 'asc' },
        },
      },
    });
    if (!interview) {
      throw new NotFoundException(
        `Entrevista ${interviewId} no existe en tu organización.`,
      );
    }
    return interview;
  }
}

// ---------------------------------------------------------------------------
// Helpers de parseo (defensivos contra LLMs que no respetan el schema)
// ---------------------------------------------------------------------------

function parseDimensionInput(
  input: unknown,
): Omit<HrDimensionScoredEvent, 'type'> | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Record<string, unknown>;
  if (typeof i.name !== 'string' || typeof i.evidence !== 'string') return null;
  const score = typeof i.score === 'number' ? i.score : Number(i.score);
  if (Number.isNaN(score)) return null;
  return {
    name: i.name,
    score: Math.max(0, Math.min(100, Math.round(score))),
    evidence: i.evidence,
  };
}

function parseFinalInput(input: unknown): Omit<HrFinalEvent, 'type'> | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Record<string, unknown>;
  const rec = i.recommendation;
  if (rec !== 'hire' && rec !== 'reconsider' && rec !== 'reject') return null;
  if (typeof i.strengths !== 'string' || typeof i.opportunities !== 'string') {
    return null;
  }
  const overall = typeof i.overall === 'number' ? i.overall : Number(i.overall);
  if (Number.isNaN(overall)) return null;
  return {
    overall: Math.max(0, Math.min(100, Math.round(overall))),
    recommendation: rec,
    strengths: i.strengths,
    opportunities: i.opportunities,
  };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

interface InterviewWithJob {
  candidateName: string;
  job: {
    title: string;
    description: string;
    dimensions: string[];
    questions: Array<{
      id: string;
      order: number;
      text: string;
      rubric: string;
    }>;
  };
  answers: Array<{
    questionId: string;
    transcript: string;
    durationSeconds: number | null;
  }>;
}

/**
 * Arma el system prompt para el scoring. Incluye:
 *   - Rol y descripción.
 *   - Dimensiones a evaluar (el LLM debe emitir UNA tool call por cada).
 *   - Pregunta + rúbrica + respuesta literal, pregunta por pregunta.
 *   - Instrucciones específicas sobre el formato y el sesgo.
 *
 * El prompt fuerza al LLM a citar evidencia textual, no a inventar — esto
 * reduce sesgos y le da al reclutador una traza auditable de cada score.
 */
export function buildScoringPrompt(interview: InterviewWithJob): string {
  const lines: string[] = [];

  lines.push(
    'Eres un evaluador de entrevistas técnicas de selección de personal. Tu trabajo es analizar las respuestas del candidato',
    'a las preguntas y emitir un scoring por dimensión + una recomendación final. NO sustituyes el juicio del reclutador',
    'humano — tu output es input para su decisión.',
    '',
    `ROL EVALUADO: ${interview.job.title}`,
    '',
    'DESCRIPCIÓN DEL ROL:',
    interview.job.description,
    '',
    `CANDIDATO: ${interview.candidateName}`,
    '',
    'DIMENSIONES A EVALUAR (debes emitir score_dimension una vez por cada, en este orden):',
  );
  for (const d of interview.job.dimensions) {
    lines.push(`  - ${d}`);
  }
  lines.push('', 'PREGUNTAS Y RESPUESTAS:', '');

  // Indexamos respuestas por questionId para juntarlas con la pregunta.
  const answerByQuestionId = new Map(
    interview.answers.map((a) => [a.questionId, a]),
  );
  for (const q of interview.job.questions) {
    const a = answerByQuestionId.get(q.id);
    const transcript = a
      ? a.transcript.slice(0, MAX_TRANSCRIPT_CHARS_PER_ANSWER)
      : '(SIN RESPUESTA)';
    const dur = a?.durationSeconds ? `[duración: ${a.durationSeconds}s] ` : '';
    lines.push(
      `── Pregunta ${q.order + 1} ──`,
      `Pregunta: ${q.text}`,
      `Rúbrica (referencia interna, NO mostrar al candidato): ${q.rubric}`,
      `Respuesta del candidato: ${dur}${transcript}`,
      '',
    );
  }

  lines.push(
    'REGLAS DE COMPORTAMIENTO:',
    '1. Para cada dimensión, llama a score_dimension(name, score, evidence). `evidence` debe ser una cita textual corta',
    '   (1 línea, ~80 caracteres) de una respuesta del candidato que justifique el score.',
    '2. Sé estricto con la evidencia: si la respuesta es vacía o trivial, el score correspondiente debe reflejarlo.',
    '3. Sé neutral sobre sesgos de origen, género, edad o acento. Evalúa la SUSTANCIA de la respuesta, no la fluidez.',
    '4. Después de emitir todas las dimensiones, llama a final_recommendation con:',
    '   - overall: 0-100 (no necesariamente promedio simple — pondera según relevancia del rol).',
    '   - recommendation: "hire" si claramente recomendado, "reconsider" si tienes dudas, "reject" si no es apto.',
    '   - strengths: 2-3 oraciones con lo positivo observado.',
    '   - opportunities: 2-3 oraciones con áreas a profundizar en próximas etapas.',
    '5. Responde en español neutro con tú.',
  );

  return lines.join('\n');
}
