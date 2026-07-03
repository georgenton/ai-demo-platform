// -----------------------------------------------------------------------------
// ClinicalService — orquestador del Demo 06.
//
// Cuatro responsabilidades:
//   1) Listar pacientes (con búsqueda) del tenant clínico aplicable.
//   2) Obtener un paciente + sus últimas consultas (para el panel central).
//   3) Listar protocolos clínicos (filtrables por categoría).
//   4) Stream del análisis del LLM con tool calling para interacciones.
//
// Resolver de "tenant de datos clínicos":
//   El demo se habilita para tenants de industria `salud`. Hoy TODOS usan el
//   mismo dataset sintético (`ctnt_clinical_shared`) — decisión 1B del ADR.
//   El resolver `resolveDataTenantId(userTenantId)` está aislado en un método
//   para que el día que una clínica firme contrato y quiera SUS pacientes
//   reales, solo se toque ese método (regla extendida del Repository pattern).
//
// Tool calling:
//   Igual que en Demo 04, el LLM puede invocar `check_drug_interactions` con
//   una lista de medicaciones. El service ejecuta el lookup contra el mock
//   farmacológico (`drug-interactions.ts`) y devuelve los matches. Loop con
//   tope MAX_TURNS para que un LLM que se obsesione no consuma cuota.
//
// Cierre del loop:
//   El LLM cierra con `stopReason: 'end_turn'` cuando dio su respuesta al
//   médico. Si pide más tools, hacemos otra vuelta. Si llegamos a MAX_TURNS,
//   emitimos `done` con `truncated` y avisamos.
// -----------------------------------------------------------------------------

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { prisma } from '@org/db';
import { chat } from '@org/llm-adapter';
import type {
  ChatProvider,
  ChatRichMessage,
  ChatTool,
  TextBlock,
  ToolUseBlock,
} from '@org/llm-adapter';

import type { ClinicalEvent } from './clinical-events.js';
import type { AnalyzeRequestDto } from './dto/analyze.request.dto.js';
import type { ListPatientsQueryDto } from './dto/list-patients.query.dto.js';
import type { ListProtocolsQueryDto } from './dto/list-protocols.query.dto.js';
import {
  checkDrugInteractions,
  type DrugInteraction,
} from './drug-interactions.js';

/**
 * Tenant compartido del seed clínico. Cualquier usuario de industria `salud`
 * resuelve a este tenant para sus consultas (decisión 1B del ADR-0016).
 *
 * Cuando entre una clínica con sus pacientes propios, este constante deja
 * de ser la única opción — el resolver elegirá entre este o el tenantId
 * propio según si la clínica trajo dataset.
 */
const SHARED_CLINICAL_TENANT_ID = 'ctnt_clinical_shared';

/** Industria que tiene acceso al demo clínico hoy. */
const CLINICAL_INDUSTRY_SLUG = 'salud';

/** Tope del loop de tool calling. Más que esto = LLM confundido. */
const MAX_TURNS = 4;

/** Últimas N consultas que se cargan como contexto del paciente. */
const CONSULTATIONS_AS_CONTEXT = 5;

/** Tope de pacientes por request de lista (defensa contra requests sin limit). */
const DEFAULT_LIST_LIMIT = 50;

/** Definición del tool del LLM. */
const CHECK_INTERACTIONS_TOOL: ChatTool = {
  name: 'check_drug_interactions',
  description:
    'Consulta la base farmacológica para encontrar interacciones medicamentosas ' +
    'entre las drogas indicadas. Úsala cuando vayas a sugerir un nuevo medicamento ' +
    'al paciente, o cuando el médico pregunte si dos drogas se pueden combinar. ' +
    'Recibe una lista de medicaciones (principios activos o nombres comerciales) ' +
    'y devuelve las interacciones encontradas con su severidad.',
  inputSchema: {
    type: 'object',
    properties: {
      medications: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Lista de medicaciones a chequear. Mínimo 2 elementos para que ' +
          'haya interacción posible. Puede incluir las que el paciente ' +
          'ya toma más la que se quiere agregar.',
      },
    },
    required: ['medications'],
  },
};

@Injectable()
export class ClinicalService {
  private readonly logger = new Logger(ClinicalService.name);

  // ---------------------------------------------------------------------------
  // Resolver de tenant de datos
  // ---------------------------------------------------------------------------

  /**
   * Devuelve el tenantId contra el cual consultar pacientes/consultas/protocolos.
   *
   * Hoy: si la industria del usuario es `salud`, todos los caminos llevan al
   * tenant compartido. Si no, 403 (no debería pasar — el guard `@RequireDemo`
   * ya filtra antes de llegar acá, pero defensa en profundidad).
   *
   * Mañana: si el tenant del usuario tiene patients propios (= un cliente
   * firmado), devolvemos su propio id. Eso se implementa cuando llegue el
   * primer cliente real.
   */
  private async resolveDataTenantId(
    userTenantId: string,
    userRole?: string,
  ): Promise<string> {
    // Bypass del superadmin: para poder hacer QA del demo en producción sin
    // tener que cambiar la industria de su tenant interno. Coherente con el
    // bypass del DemoAccessGuard y del GET /me/demos.
    if (userRole === 'superadmin') {
      return SHARED_CLINICAL_TENANT_ID;
    }

    // El Tenant referencia a Industry por industryId. Para conocer el slug de
    // la industria, hacemos un select con include de la relación. Más limpio
    // que dos queries.
    const tenant = await prisma.tenant.findUnique({
      where: { id: userTenantId },
      select: { industry: { select: { slug: true } } },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${userTenantId} no existe.`);
    }
    if (tenant.industry.slug !== CLINICAL_INDUSTRY_SLUG) {
      throw new ForbiddenException(
        'El demo clínico solo está disponible para tenants de industria salud.',
      );
    }
    return SHARED_CLINICAL_TENANT_ID;
  }

  // ---------------------------------------------------------------------------
  // Lectura de datos
  // ---------------------------------------------------------------------------

  /**
   * Lista pacientes ordenados por displayName ascendente. Search es
   * case-insensitive y matchea substring.
   */
  async listPatients(
    userTenantId: string,
    dto: ListPatientsQueryDto,
    userRole?: string,
  ) {
    const dataTenantId = await this.resolveDataTenantId(userTenantId, userRole);
    const limit = dto.limit ?? DEFAULT_LIST_LIMIT;

    const where = {
      tenantId: dataTenantId,
      ...(dto.search
        ? {
            displayName: {
              contains: dto.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { displayName: 'asc' },
      take: limit,
      select: {
        id: true,
        displayName: true,
        age: true,
        gender: true,
        chronicConditions: true,
      },
    });

    return { items: patients, total: patients.length };
  }

  /**
   * Detalle del paciente + últimas N consultas (DESC por fecha). Si no existe
   * en el tenant resuelto, 404.
   */
  async getPatient(userTenantId: string, patientId: string, userRole?: string) {
    const dataTenantId = await this.resolveDataTenantId(userTenantId, userRole);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: dataTenantId },
      include: {
        consultations: {
          orderBy: { date: 'desc' },
          take: 10, // mostramos hasta 10 al UI; el LLM usa solo 5 (constante arriba).
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(
        `Paciente ${patientId} no existe en el dataset clínico.`,
      );
    }

    return patient;
  }

  /**
   * Lista protocolos clínicos. Si `category` viene, filtra; si no, devuelve
   * todos agrupables por categoría en el frontend.
   */
  async listProtocols(
    userTenantId: string,
    dto: ListProtocolsQueryDto,
    userRole?: string,
  ) {
    const dataTenantId = await this.resolveDataTenantId(userTenantId, userRole);

    const protocols = await prisma.clinicalProtocol.findMany({
      where: {
        tenantId: dataTenantId,
        ...(dto.category ? { category: dto.category } : {}),
      },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        category: true,
        content: true,
      },
    });

    return { items: protocols, total: protocols.length };
  }

  // ---------------------------------------------------------------------------
  // Análisis con LLM + tool calling
  // ---------------------------------------------------------------------------

  /**
   * Stream del análisis. Patrón idéntico al AgentService (Demo 04):
   *   - Cargamos paciente + sus últimas N consultas como contexto.
   *   - Armamos system prompt con todo eso + reglas de comportamiento.
   *   - Loop: stream tokens, capturar tool_use, ejecutar tool, re-iterar.
   *   - Cerrar con `done`.
   *
   * El frontend recibe los eventos SSE y los pinta como burbuja del LLM +
   * cards de "consultando interacciones" / "encontré 2 interacciones graves".
   */
  async *streamAnalyze(
    dto: AnalyzeRequestDto,
    userTenantId: string,
    userRole?: string,
    llmProvider?: ChatProvider,
  ): AsyncIterable<ClinicalEvent> {
    const dataTenantId = await this.resolveDataTenantId(userTenantId, userRole);

    // Cargamos paciente + contexto. Si no existe, lanzamos antes de empezar
    // el stream (el controller lo convierte en HTTP 404 normal, no SSE error).
    const patient = await prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId: dataTenantId },
      include: {
        consultations: {
          orderBy: { date: 'desc' },
          take: CONSULTATIONS_AS_CONTEXT,
        },
      },
    });
    if (!patient) {
      throw new NotFoundException(
        `Paciente ${dto.patientId} no existe en el dataset clínico.`,
      );
    }

    this.logger.log(
      `clinical analyze → patient="${patient.displayName}" question="${dto.question.slice(0, 120)}"`,
    );

    const guidedDifferential = buildGuidedDifferentialAnswer(
      dto.question,
      patient,
    );
    if (guidedDifferential) {
      yield { type: 'token', text: guidedDifferential };
      yield { type: 'done', turns: 0 };
      return;
    }

    const messages: ChatRichMessage[] = [
      { role: 'system', content: buildSystemPrompt(patient) },
      { role: 'user', content: dto.question },
    ];

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

        for await (const event of chat.streamWithTools(
          messages,
          [CHECK_INTERACTIONS_TOOL],
          { provider: llmProvider },
        )) {
          if (event.type === 'text_delta') {
            const safeText = sanitizeClinicalOutput(event.text);
            if (!safeText) {
              continue;
            }
            const last = assistantBlocks[assistantBlocks.length - 1];
            if (last && last.type === 'text') {
              last.text += safeText;
            } else {
              assistantBlocks.push({ type: 'text', text: safeText });
            }
            yield { type: 'token', text: safeText };
          } else if (event.type === 'tool_use_complete') {
            assistantBlocks.push({
              type: 'tool_use',
              id: event.id,
              name: event.name,
              input: event.input,
            });

            if (event.name !== 'check_drug_interactions') {
              const errMsg = `Tool desconocido: "${event.name}".`;
              toolResults.push({
                toolUseId: event.id,
                content: errMsg,
                isError: true,
              });
              continue;
            }

            const input = event.input as { medications?: unknown };
            const meds = Array.isArray(input.medications)
              ? input.medications.filter(
                  (m): m is string => typeof m === 'string',
                )
              : [];

            yield {
              type: 'tool_call',
              toolName: 'check_drug_interactions',
              medications: meds,
            };

            const interactions: DrugInteraction[] = checkDrugInteractions(meds);

            yield {
              type: 'tool_result',
              interactions: interactions.map((i) => ({
                drugA: i.drugA,
                drugB: i.drugB,
                severity: i.severity,
                description: i.description,
              })),
            };

            // Lo que mandamos AL LLM en el tool_result puede ser distinto de
            // lo que mandamos al frontend. Acá mandamos JSON estructurado;
            // el LLM lo parafrasea en su respuesta humana.
            toolResults.push({
              toolUseId: event.id,
              content: JSON.stringify({ interactions }),
              isError: false,
            });
          } else if (event.type === 'turn_end') {
            stopReason = event.stopReason;
          }
        }

        // Si el LLM no emitió bloques (raro), agregamos uno vacío para no
        // romper la alternancia que Anthropic exige en messages[].
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
        yield { type: 'done', turns };
        return;
      }

      // Salida por MAX_TURNS.
      this.logger.warn(`clinical analyze hit MAX_TURNS=${MAX_TURNS}`);
      yield { type: 'done', turns };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`clinical analyze failed: ${message}`);
      yield { type: 'error_event', message };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers de prompt
// ---------------------------------------------------------------------------

/**
 * Tipo "shape" del paciente con sus últimas consultas, para evitar tirar
 * tipos largos en la firma del helper.
 */
interface PatientWithContext {
  displayName: string;
  age: number;
  gender: string;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: string[];
  consultations: Array<{
    date: Date;
    treatingPhysician: string;
    reasonForVisit: string;
    examFindings: string | null;
    diagnosis: string;
    treatment: string;
    notes: string | null;
  }>;
}

/**
 * Arma el system prompt con la historia clínica del paciente.
 *
 * Decisiones del prompt:
 *   - El asistente es de apoyo al médico, NO sustituye el juicio clínico
 *     (línea defensiva obligatoria del demo).
 *   - El LLM debe citar fuentes de la historia clínica cuando aplique.
 *   - El LLM tiene la tool `check_drug_interactions` y se le dice
 *     explícitamente cuándo conviene usarla.
 *   - Responde en español, técnico pero claro.
 */
export function buildSystemPrompt(patient: PatientWithContext): string {
  const consultationsBlock =
    patient.consultations.length === 0
      ? '  (Sin consultas previas registradas.)'
      : patient.consultations
          .map((c, i) => {
            const dateStr = c.date.toISOString().slice(0, 10);
            const consultationLabel =
              i === 0
                ? `  [Consulta ${i + 1} - más reciente]`
                : `  [Consulta ${i + 1}]`;
            return [
              `${consultationLabel} ${dateStr} — atendido por ${c.treatingPhysician}`,
              `  - Motivo: ${c.reasonForVisit}`,
              c.examFindings ? `  - Examen: ${c.examFindings}` : null,
              `  - Diagnóstico: ${c.diagnosis}`,
              `  - Tratamiento: ${c.treatment}`,
              c.notes ? `  - Notas: ${c.notes}` : null,
            ]
              .filter(Boolean)
              .join('\n');
          })
          .join('\n\n');

  const allergies =
    patient.allergies.length > 0
      ? patient.allergies.join(', ')
      : 'Ninguna conocida';
  const conditions =
    patient.chronicConditions.length > 0
      ? patient.chronicConditions.join(', ')
      : 'Ninguna registrada';
  const meds =
    patient.currentMedications.length > 0
      ? patient.currentMedications.map((m) => `  - ${m}`).join('\n')
      : '  (Ninguna registrada)';

  return `Eres un asistente clínico de apoyo al médico tratante. NO sustituyes el juicio clínico del profesional — tu rol es organizar información de la historia y advertir sobre riesgos conocidos.

CONTEXTO DEL PACIENTE (datos sintéticos del sistema):

- Nombre: ${patient.displayName}
- Edad: ${patient.age} años
- Sexo: ${patient.gender}
- Alergias: ${allergies}
- Condiciones crónicas: ${conditions}
- Medicación actual:
${meds}

ÚLTIMAS ${patient.consultations.length} CONSULTAS:

${consultationsBlock}

REGLAS DE COMPORTAMIENTO:
1. Responde siempre y exclusivamente en español. No incluyas chino, inglés ni ningún otro idioma. Sin emojis.
2. Cita fragmentos de la historia clínica cuando los uses ("según consulta del 2025-04-12...").
3. Si el médico va a recetar un medicamento o pregunta por interacciones, USA la herramienta \`check_drug_interactions\` con la lista de medicaciones actuales + la nueva. Espera el resultado antes de responder.
4. Si el médico pregunta por diagnóstico diferencial sin indicar síntoma, motivo actual o problema específico, responde anclando el diferencial SOLO a la Consulta 1 - más reciente. Aclara ese alcance y pide el síntoma principal si se necesita más precisión.
5. No mezcles problemas antiguos como si todos fueran el cuadro actual. Diferencia "antecedente/consulta previa" de "problema activo".
6. No atribuyas enfermedades crónicas que no constan en la ficha de condiciones crónicas, salvo que lo menciones explícitamente como antecedente documentado en una consulta previa.
7. Para diagnóstico diferencial, prioriza 3-5 causas frecuentes y compatibles con el motivo de consulta, examen físico y antecedentes. Evita términos raros, diagnósticos exóticos o entidades de baja probabilidad si no hay datos que las sostengan.
8. Si la Consulta 1 es cefalea con náusea, examen neurológico normal y sin signos de alarma documentados, considera diferenciales habituales como cefalea tensional, migraña, cefalea asociada a tensión arterial/estrés, medicación/cafeína o deshidratación. Menciona que meningitis, hemorragia, tumor, aneurisma, intoxicaciones u otras causas graves se reservan para red flags o hallazgos compatibles.
9. Si no encuentras información suficiente en la historia para responder con seguridad, dilo explícitamente. NO inventes datos.
10. Termina siempre con un breve recordatorio: "La decisión clínica final corresponde al médico tratante."`;
}

const NON_SPANISH_SCRIPT_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3100-\u312f\u31a0-\u31bf]+/gu;
const CJK_PUNCTUATION_RE = /[\u3000-\u303f\uff00-\uffef]+/g;

/**
 * Defensa de salida para modelos locales multilingües.
 *
 * El prompt ya fuerza español, pero modelos como Qwen pueden derivar a chino
 * en mitad de un stream. Sanitizamos antes de mandar tokens al navegador y
 * antes de guardar el bloque que se reinyecta al loop de tool calling.
 */
export function sanitizeClinicalOutput(text: string): string {
  return text
    .replace(NON_SPANISH_SCRIPT_RE, '')
    .replace(CJK_PUNCTUATION_RE, ' ')
    .replace(/[ \t]{2,}/g, ' ');
}

function normalizeClinicalQuestion(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Fallback determinístico para preguntas sugeridas demasiado amplias.
 *
 * En el demo clínico el modelo local puede inventar diferenciales raros si el
 * médico pregunta "qué diagnóstico diferencial" sin un síntoma nuevo. Para la
 * consulta más reciente del paciente sintético, es más seguro devolver una
 * guía conservadora, trazable y estable que forzar al LLM a improvisar.
 */
export function buildGuidedDifferentialAnswer(
  question: string,
  patient: PatientWithContext,
): string | null {
  const normalizedQuestion = normalizeClinicalQuestion(question);
  if (!normalizedQuestion.includes('diagnostico diferencial')) {
    return null;
  }

  const latest = patient.consultations[0];
  if (!latest) return null;

  const latestContext = normalizeClinicalQuestion(
    [
      latest.reasonForVisit,
      latest.examFindings ?? '',
      latest.diagnosis,
      latest.notes ?? '',
    ].join(' '),
  );
  if (!latestContext.includes('cefalea')) {
    return null;
  }

  const dateStr = latest.date.toISOString().slice(0, 10);
  const examSummary = latest.examFindings
    ? ` El examen registrado fue: ${latest.examFindings}`
    : '';

  return [
    `Según la consulta del ${dateStr}, el motivo fue "${latest.reasonForVisit}" y el diagnóstico registrado fue "${latest.diagnosis}".${examSummary}`,
    '',
    'Con ese alcance, un diferencial razonable y conservador sería:',
    '1. Cefalea tensional persistente o recurrente, coherente con el diagnóstico previo y el contexto de estrés.',
    '2. Migraña, especialmente por la náusea asociada, aunque faltan datos como fotofobia, fonofobia, aura o patrón recurrente.',
    '3. Cefalea asociada a variación de tensión arterial, considerando el antecedente de HTA.',
    '4. Cefalea relacionada con deshidratación, sueño insuficiente, cafeína, estrés o uso de analgésicos.',
    '5. Rinosinusitis u otra causa intercurrente solo si aparecen congestión, fiebre, dolor facial u otros síntomas compatibles.',
    '',
    'En la historia disponible no hay signos de alarma documentados. Si aparecieran cefalea súbita intensa, déficit neurológico, fiebre con rigidez de nuca, trauma, empeoramiento progresivo, alteración de conciencia o papiledema, el diferencial cambia y requiere evaluación urgente.',
    '',
    'La decisión clínica final corresponde al médico tratante.',
  ].join('\n');
}
