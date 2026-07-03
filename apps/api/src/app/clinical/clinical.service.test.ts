// -----------------------------------------------------------------------------
// Tests del ClinicalService.
//
// Mockeamos:
//   - prisma de @org/db (tenant, patient, clinicalProtocol).
//   - chat de @org/llm-adapter — no se invoca en los tests de lectura.
//
// Cubrimos:
//   - resolveDataTenantId resuelve a `ctnt_clinical_shared` si la industria
//     del user es 'salud'.
//   - listPatients construye el `where` con search insensitive cuando viene
//     `search`, y sin él cuando no.
//   - getPatient resuelve OK y propaga 404 cuando no existe.
//   - listProtocols filtra por categoría si viene, y trae todos si no.
//   - buildSystemPrompt incluye datos críticos del paciente en el texto.
//
// El test del stream con tool calling NO va acá — eso es integración con LLM,
// y en este sprint se valida con smoke test manual + el integration suite que
// corre con FAKE provider.
// -----------------------------------------------------------------------------

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks de los packages externos al módulo.
vi.mock('@org/db', () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    patient: { findMany: vi.fn(), findFirst: vi.fn() },
    clinicalProtocol: { findMany: vi.fn() },
  },
}));
vi.mock('@org/llm-adapter', () => ({
  chat: { streamWithTools: vi.fn() },
}));

import { prisma } from '@org/db';
import { chat } from '@org/llm-adapter';

import {
  buildGuidedDifferentialAnswer,
  buildSystemPrompt,
  ClinicalService,
  sanitizeClinicalOutput,
} from './clinical.service.js';

const SHARED_TENANT_ID = 'ctnt_clinical_shared';

describe('ClinicalService', () => {
  let service: ClinicalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClinicalService();
  });

  // ---------------------------------------------------------------------------
  // resolveDataTenantId — implícito vía métodos públicos
  // ---------------------------------------------------------------------------

  describe('resolveDataTenantId', () => {
    it('para industria salud devuelve el tenant compartido', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        industry: { slug: 'salud' },
      });
      (prisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      await service.listPatients('tenant-user-salud', {});

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: SHARED_TENANT_ID }),
        }),
      );
    });

    it('lanza ForbiddenException para industria != salud', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        industry: { slug: 'banca' },
      });

      await expect(
        service.listPatients('tenant-user-banca', {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si el tenant del user no existe', async () => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.listPatients('tenant-inexistente', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('superadmin pasa siempre, aunque su tenant no sea salud', async () => {
      // Bypass del superadmin: la cuenta admin@nai.local vive en el tenant
      // interno (industria 'universidad') pero necesita poder hacer QA del
      // demo clínico. Sin este bypass, vería el demo en el sidebar pero
      // recibiría 403 al consultarlo.
      (prisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      await service.listPatients('tenant-superadmin', {}, 'superadmin');

      // No debería consultar el tenant en absoluto — el bypass corta antes.
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: SHARED_TENANT_ID }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listPatients
  // ---------------------------------------------------------------------------

  describe('listPatients', () => {
    beforeEach(() => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        industry: { slug: 'salud' },
      });
    });

    it('sin search arma el where solo con tenantId', async () => {
      (prisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'p1', displayName: 'Ana' },
      ]);

      await service.listPatients('tenant-user', {});

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: SHARED_TENANT_ID },
          orderBy: { displayName: 'asc' },
        }),
      );
    });

    it('con search agrega filtro insensitive sobre displayName', async () => {
      (prisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      await service.listPatients('tenant-user', { search: 'María' });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: SHARED_TENANT_ID,
            displayName: { contains: 'María', mode: 'insensitive' },
          },
        }),
      );
    });

    it('respeta el limit del DTO cuando viene', async () => {
      (prisma.patient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        [],
      );

      await service.listPatients('tenant-user', { limit: 7 });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 7 }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPatient
  // ---------------------------------------------------------------------------

  describe('getPatient', () => {
    beforeEach(() => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        industry: { slug: 'salud' },
      });
    });

    it('devuelve el paciente con sus últimas 10 consultas', async () => {
      const fakePatient = {
        id: 'pX',
        displayName: 'María Elena Vásquez',
        consultations: [],
      };
      (prisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        fakePatient,
      );

      const result = await service.getPatient('tenant-user', 'pX');

      expect(result).toBe(fakePatient);
      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pX', tenantId: SHARED_TENANT_ID },
          include: expect.objectContaining({
            consultations: expect.objectContaining({
              orderBy: { date: 'desc' },
              take: 10,
            }),
          }),
        }),
      );
    });

    it('lanza NotFoundException si Prisma devuelve null', async () => {
      (prisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.getPatient('tenant-user', 'pX-falso'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // listProtocols
  // ---------------------------------------------------------------------------

  describe('listProtocols', () => {
    beforeEach(() => {
      (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        industry: { slug: 'salud' },
      });
    });

    it('sin category trae todos los protocolos', async () => {
      (
        prisma.clinicalProtocol.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([{ id: 'pr1' }, { id: 'pr2' }]);

      const result = await service.listProtocols('tenant-user', {});

      expect(result.total).toBe(2);
      expect(prisma.clinicalProtocol.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: SHARED_TENANT_ID },
        }),
      );
    });

    it('con category aplica el filtro exacto', async () => {
      (
        prisma.clinicalProtocol.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      await service.listProtocols('tenant-user', { category: 'cardiologia' });

      expect(prisma.clinicalProtocol.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: SHARED_TENANT_ID, category: 'cardiologia' },
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // streamAnalyze
  // ---------------------------------------------------------------------------

  describe('streamAnalyze', () => {
    it('sanitiza caracteres CJK antes de emitir tokens al frontend', async () => {
      (prisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'p_carlos',
        displayName: 'Carlos Andrés Mendoza',
        age: 58,
        gender: 'M',
        allergies: [],
        chronicConditions: ['HTA', 'dislipidemia'],
        currentMedications: ['losartán 50mg QD', 'atorvastatina 20mg QD'],
        consultations: [
          {
            date: new Date('2025-10-01T08:00:00Z'),
            treatingPhysician: 'Dra. Mejía',
            reasonForVisit: 'Cefalea de 3 días con náusea',
            examFindings: 'TA 142/88 mmHg. Examen neurológico normal.',
            diagnosis: 'Cefalea tensional secundaria a estrés',
            treatment: 'Paracetamol 500mg c/8h por 3 días. Hidratación.',
            notes: 'Sin signos de alarma.',
          },
        ],
      });
      (chat.streamWithTools as ReturnType<typeof vi.fn>).mockImplementation(
        async function* () {
          yield {
            type: 'text_delta',
            text: 'Diferencial anclado a la consulta reciente. 详细的答復如下：',
          };
          yield { type: 'turn_end', stopReason: 'end_turn' };
        },
      );

      const events = [];
      for await (const event of service.streamAnalyze(
        {
          patientId: 'p_carlos',
          question: 'Resume la consulta más reciente.',
        },
        'tenant-superadmin',
        'superadmin',
      )) {
        events.push(event);
      }

      const answer = events
        .filter((event) => event.type === 'token')
        .map((event) => ('text' in event ? event.text : ''))
        .join('');

      expect(answer).toContain('Diferencial anclado');
      expect(answer).not.toMatch(
        /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u,
      );
      expect(events.at(-1)).toEqual({ type: 'done', turns: 1 });
    });

    it('usa fallback guiado para diferencial amplio de cefalea y no llama al LLM', async () => {
      (prisma.patient.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'p_carlos',
        displayName: 'Carlos Andrés Mendoza',
        age: 58,
        gender: 'M',
        allergies: [],
        chronicConditions: ['HTA', 'dislipidemia'],
        currentMedications: ['losartán 50mg QD', 'atorvastatina 20mg QD'],
        consultations: [
          {
            date: new Date('2025-10-01T08:00:00Z'),
            treatingPhysician: 'Dra. Mejía',
            reasonForVisit: 'Cefalea de 3 días con náusea',
            examFindings: 'TA 142/88 mmHg. Examen neurológico normal.',
            diagnosis: 'Cefalea tensional secundaria a estrés',
            treatment: 'Paracetamol 500mg c/8h por 3 días. Hidratación.',
            notes: 'Sin signos de alarma.',
          },
        ],
      });

      const events = [];
      for await (const event of service.streamAnalyze(
        {
          patientId: 'p_carlos',
          question:
            'Según la consulta más reciente, ¿qué diagnóstico diferencial debo considerar?',
        },
        'tenant-superadmin',
        'superadmin',
        'private-mac',
      )) {
        events.push(event);
      }

      const answer = events
        .filter((event) => event.type === 'token')
        .map((event) => ('text' in event ? event.text : ''))
        .join('');

      expect(chat.streamWithTools).not.toHaveBeenCalled();
      expect(answer).toContain('Cefalea tensional');
      expect(answer).toContain('Migraña');
      expect(answer).toContain('antecedente de HTA');
      expect(answer).toContain(
        'La decisión clínica final corresponde al médico tratante.',
      );
      expect(answer).not.toMatch(/Meier|hipogénic|intoxic/i);
      expect(events.at(-1)).toEqual({ type: 'done', turns: 0 });
    });
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt — helper puro
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('incluye nombre, edad, alergias, condiciones y medicaciones', () => {
    const prompt = buildSystemPrompt({
      displayName: 'María Elena Vásquez',
      age: 67,
      gender: 'F',
      allergies: ['penicilina'],
      chronicConditions: ['HTA', 'DM2'],
      currentMedications: ['metformina 850mg BID', 'enalapril 10mg QD'],
      consultations: [],
    });

    expect(prompt).toContain('María Elena Vásquez');
    expect(prompt).toContain('67 años');
    expect(prompt).toContain('penicilina');
    expect(prompt).toContain('HTA, DM2');
    expect(prompt).toContain('metformina 850mg BID');
  });

  it('renderiza correctamente cuando no hay consultas previas', () => {
    const prompt = buildSystemPrompt({
      displayName: 'Diego Velasco',
      age: 26,
      gender: 'M',
      allergies: [],
      chronicConditions: [],
      currentMedications: [],
      consultations: [],
    });

    expect(prompt).toContain('Sin consultas previas registradas');
    expect(prompt).toContain('Ninguna conocida');
    expect(prompt).toContain('Ninguna registrada');
  });

  it('incluye fragmentos de cada consulta previa', () => {
    const prompt = buildSystemPrompt({
      displayName: 'Test',
      age: 50,
      gender: 'M',
      allergies: [],
      chronicConditions: [],
      currentMedications: [],
      consultations: [
        {
          date: new Date('2025-04-12T10:00:00Z'),
          treatingPhysician: 'Dr. Pérez',
          reasonForVisit: 'Control HTA',
          examFindings: 'TA 140/90',
          diagnosis: 'HTA estadio 1',
          treatment: 'Enalapril 10mg QD',
          notes: 'Reevaluar en 4 semanas',
        },
      ],
    });

    expect(prompt).toContain('2025-04-12');
    expect(prompt).toContain('Consulta 1 - más reciente');
    expect(prompt).toContain('Dr. Pérez');
    expect(prompt).toContain('Control HTA');
    expect(prompt).toContain('HTA estadio 1');
    expect(prompt).toContain('Reevaluar en 4 semanas');
  });

  it('incluye la línea defensiva sobre el juicio clínico', () => {
    const prompt = buildSystemPrompt({
      displayName: 'X',
      age: 30,
      gender: 'M',
      allergies: [],
      chronicConditions: [],
      currentMedications: [],
      consultations: [],
    });
    expect(prompt).toContain('decisión clínica final corresponde al médico');
  });

  it('fuerza español exclusivo y ancla diferenciales amplios a la consulta más reciente', () => {
    const prompt = buildSystemPrompt({
      displayName: 'Carlos Andrés Mendoza',
      age: 58,
      gender: 'M',
      allergies: [],
      chronicConditions: ['HTA', 'dislipidemia'],
      currentMedications: ['losartán 50mg QD'],
      consultations: [],
    });

    expect(prompt).toContain('exclusivamente en español');
    expect(prompt).toContain('No incluyas chino, inglés ni ningún otro idioma');
    expect(prompt).toContain('diagnóstico diferencial');
    expect(prompt).toContain('SOLO a la Consulta 1 - más reciente');
    expect(prompt).toContain('prioriza 3-5 causas frecuentes');
    expect(prompt).toContain('cefalea con náusea');
    expect(prompt).toContain('examen neurológico normal');
    expect(prompt).toContain('se reservan para red flags');
  });
});

// ---------------------------------------------------------------------------
// sanitizeClinicalOutput — helper puro
// ---------------------------------------------------------------------------

describe('sanitizeClinicalOutput', () => {
  it('elimina caracteres chinos sin alterar el texto clínico en español', () => {
    const output = sanitizeClinicalOutput(
      'Diagnóstico diferencial: cefalea tensional. 详细的答復如下： 基于病史。',
    );

    expect(output).toContain('Diagnóstico diferencial');
    expect(output).toContain('cefalea tensional');
    expect(output).not.toMatch(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u,
    );
  });
});

// ---------------------------------------------------------------------------
// buildGuidedDifferentialAnswer — fallback determinístico
// ---------------------------------------------------------------------------

describe('buildGuidedDifferentialAnswer', () => {
  it('devuelve un diferencial conservador para cefalea reciente sin red flags', () => {
    const answer = buildGuidedDifferentialAnswer(
      '¿Qué diagnóstico diferencial debo considerar?',
      {
        displayName: 'Carlos Andrés Mendoza',
        age: 58,
        gender: 'M',
        allergies: [],
        chronicConditions: ['HTA', 'dislipidemia'],
        currentMedications: ['losartán 50mg QD'],
        consultations: [
          {
            date: new Date('2025-10-01T08:00:00Z'),
            treatingPhysician: 'Dra. Mejía',
            reasonForVisit: 'Cefalea de 3 días con náusea',
            examFindings: 'TA 142/88 mmHg. Examen neurológico normal.',
            diagnosis: 'Cefalea tensional secundaria a estrés',
            treatment: 'Paracetamol 500mg c/8h por 3 días. Hidratación.',
            notes: 'Sin signos de alarma.',
          },
        ],
      },
    );

    expect(answer).not.toBeNull();
    expect(answer).toContain('2025-10-01');
    expect(answer).toContain('Cefalea tensional');
    expect(answer).toContain('Migraña');
    expect(answer).toContain('signos de alarma');
    expect(answer).toContain(
      'La decisión clínica final corresponde al médico tratante.',
    );
    expect(answer).not.toMatch(/Meier|hipogénic|intoxic/i);
  });

  it('no aplica si la pregunta no es de diagnóstico diferencial', () => {
    const answer = buildGuidedDifferentialAnswer('Resume la historia.', {
      displayName: 'Carlos Andrés Mendoza',
      age: 58,
      gender: 'M',
      allergies: [],
      chronicConditions: ['HTA'],
      currentMedications: [],
      consultations: [],
    });

    expect(answer).toBeNull();
  });
});
