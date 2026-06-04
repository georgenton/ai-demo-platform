// -----------------------------------------------------------------------------
// Tests del HrService — métodos de lectura/escritura sin tocar el stream del
// LLM (eso lo cubrirá el smoke en producción con FAKE provider).
//
// Mockeamos:
//   - prisma de @org/db con los modelos que tocamos (job, jobQuestion,
//     interview, interviewAnswer).
//   - chat de @org/llm-adapter — no se invoca en estos tests.
//
// Cubrimos:
//   - listJobs: arma el where con SHARED_JOBS_TENANT_ID, ordena por title.
//   - getJob: 404 cuando no existe, devuelve cuando sí.
//   - createInterview: 404 si jobId no existe, OK con primera pregunta.
//   - createInterview: 400 si el rol no tiene preguntas configuradas.
//   - getNextQuestion: marker done cuando todas tienen respuesta.
//   - getNextQuestion: 400 si la entrevista no está in_progress.
//   - recordAnswer: 400 si la pregunta no es del rol de la entrevista.
//   - recordAnswer: upsert válido.
//   - buildScoringPrompt: incluye datos clave de cada respuesta + reglas.
// -----------------------------------------------------------------------------

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@org/db', () => ({
  prisma: {
    job: { findMany: vi.fn(), findFirst: vi.fn() },
    jobQuestion: { findFirst: vi.fn(), findUnique: vi.fn() },
    interview: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    interviewAnswer: { upsert: vi.fn() },
  },
}));
vi.mock('@org/llm-adapter', () => ({
  chat: { streamWithTools: vi.fn() },
}));

import { prisma } from '@org/db';

import { buildScoringPrompt, HrService } from './hr.service.js';

const SHARED_TENANT_ID = 'ctnt_hr_shared';

describe('HrService', () => {
  let service: HrService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HrService();
  });

  // ---------------------------------------------------------------------------
  // listJobs
  // ---------------------------------------------------------------------------

  describe('listJobs', () => {
    it('arma el where con el tenant compartido y ordena por title', async () => {
      (prisma.job.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'j1', title: 'A', _count: { questions: 5 } },
      ]);

      const result = await service.listJobs();

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: SHARED_TENANT_ID },
          orderBy: { title: 'asc' },
        }),
      );
      expect(result.total).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getJob
  // ---------------------------------------------------------------------------

  describe('getJob', () => {
    it('devuelve el rol cuando existe', async () => {
      const fakeJob = {
        id: 'j1',
        title: 'Dev junior',
        _count: { questions: 5 },
      };
      (prisma.job.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        fakeJob,
      );

      const result = await service.getJob('j1');
      expect(result).toBe(fakeJob);
    });

    it('lanza NotFoundException si no existe', async () => {
      (prisma.job.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(service.getJob('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createInterview
  // ---------------------------------------------------------------------------

  describe('createInterview', () => {
    it('crea la entrevista y devuelve la primera pregunta', async () => {
      (prisma.job.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'j1',
        slug: 'dev-junior',
        title: 'Dev junior',
        _count: { questions: 5 },
      });
      (prisma.interview.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'iv1',
      });
      (
        prisma.jobQuestion.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'q0', order: 0, text: 'Cuéntame…' });

      const result = await service.createInterview('tenant-empresa', {
        jobId: 'j1',
        candidateName: 'Juan Pérez',
      });

      expect(result).toEqual({
        interviewId: 'iv1',
        jobTitle: 'Dev junior',
        totalQuestions: 5,
        currentQuestion: { id: 'q0', order: 0, text: 'Cuéntame…' },
      });
      expect(prisma.interview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-empresa',
            jobId: 'j1',
            candidateName: 'Juan Pérez',
            status: 'in_progress',
          }),
        }),
      );
    });

    it('propaga 404 si el jobId no existe', async () => {
      (prisma.job.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        service.createInterview('t', { jobId: 'falso', candidateName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequest si el rol no tiene preguntas', async () => {
      (prisma.job.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'j1',
        slug: 'dev-junior',
        title: 'Dev junior',
        _count: { questions: 0 },
      });
      (prisma.interview.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'iv1',
      });
      (
        prisma.jobQuestion.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      await expect(
        service.createInterview('t', { jobId: 'j1', candidateName: 'X' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // getNextQuestion
  // ---------------------------------------------------------------------------

  describe('getNextQuestion', () => {
    it('devuelve marker done cuando todas las preguntas están respondidas', async () => {
      (
        prisma.interview.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'iv1',
        jobId: 'j1',
        status: 'in_progress',
        answers: [{ questionId: 'q0' }, { questionId: 'q1' }],
      });
      (
        prisma.jobQuestion.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await service.getNextQuestion('tenant', 'iv1');
      expect(result).toEqual({ done: true, answeredCount: 2 });
    });

    it('devuelve la siguiente pregunta cuando quedan', async () => {
      (
        prisma.interview.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'iv1',
        jobId: 'j1',
        status: 'in_progress',
        answers: [{ questionId: 'q0' }],
      });
      (
        prisma.jobQuestion.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'q1', order: 1, text: '¿Cómo te organizas?' });

      const result = await service.getNextQuestion('tenant', 'iv1');
      expect(result).toEqual({
        done: false,
        currentQuestion: { id: 'q1', order: 1, text: '¿Cómo te organizas?' },
        answeredCount: 1,
      });
    });

    it('lanza 404 si la entrevista no pertenece al tenant', async () => {
      (
        prisma.interview.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      await expect(service.getNextQuestion('tenant', 'iv1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza BadRequest si la entrevista ya está cerrada', async () => {
      (
        prisma.interview.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'iv1',
        jobId: 'j1',
        status: 'finalized',
        answers: [],
      });
      await expect(service.getNextQuestion('tenant', 'iv1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // recordAnswer
  // ---------------------------------------------------------------------------

  describe('recordAnswer', () => {
    it('hace upsert si la pregunta pertenece al rol de la entrevista', async () => {
      (
        prisma.interview.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'iv1',
        jobId: 'j1',
        status: 'in_progress',
        answers: [],
      });
      (
        prisma.jobQuestion.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'q0', jobId: 'j1' });
      (
        prisma.interviewAnswer.upsert as ReturnType<typeof vi.fn>
      ).mockResolvedValue({});

      const result = await service.recordAnswer('tenant', 'iv1', {
        questionId: 'q0',
        transcript: 'Mi respuesta',
        durationSeconds: 45,
      });

      expect(result.ok).toBe(true);
      expect(prisma.interviewAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            interviewId_questionId: {
              interviewId: 'iv1',
              questionId: 'q0',
            },
          },
        }),
      );
    });

    it('lanza BadRequest si la pregunta no pertenece al rol', async () => {
      (
        prisma.interview.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'iv1',
        jobId: 'j1',
        status: 'in_progress',
        answers: [],
      });
      (
        prisma.jobQuestion.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ id: 'q0', jobId: 'j2-otro' });

      await expect(
        service.recordAnswer('tenant', 'iv1', {
          questionId: 'q0',
          transcript: 'X',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

// ---------------------------------------------------------------------------
// buildScoringPrompt — helper puro
// ---------------------------------------------------------------------------

describe('buildScoringPrompt', () => {
  it('incluye rol, candidato, dimensiones, preguntas y respuestas', () => {
    const prompt = buildScoringPrompt({
      candidateName: 'Juan Pérez',
      job: {
        title: 'Dev junior backend',
        description: 'Posición para alguien con 0-2 años de experiencia.',
        dimensions: ['claridad', 'conocimiento técnico'],
        questions: [
          {
            id: 'q0',
            order: 0,
            text: 'Cuéntame de un proyecto reciente.',
            rubric: 'Buscamos estructura.',
          },
          {
            id: 'q1',
            order: 1,
            text: '¿Qué es REST?',
            rubric: 'Analogías claras.',
          },
        ],
      },
      answers: [
        {
          questionId: 'q0',
          transcript: 'Trabajé en una API de delivery.',
          durationSeconds: 30,
        },
      ],
    });

    expect(prompt).toContain('Dev junior backend');
    expect(prompt).toContain('Juan Pérez');
    expect(prompt).toContain('claridad');
    expect(prompt).toContain('Cuéntame de un proyecto reciente.');
    expect(prompt).toContain('Trabajé en una API de delivery.');
    // La pregunta 1 no tiene respuesta — debe quedar el marker.
    expect(prompt).toContain('(SIN RESPUESTA)');
  });

  it('incluye instrucciones obligatorias sobre tools + sesgo', () => {
    const prompt = buildScoringPrompt({
      candidateName: 'X',
      job: {
        title: 'Y',
        description: 'Z',
        dimensions: ['d1'],
        questions: [{ id: 'q', order: 0, text: 'p', rubric: 'r' }],
      },
      answers: [],
    });
    expect(prompt).toContain('score_dimension');
    expect(prompt).toContain('final_recommendation');
    expect(prompt).toContain('Sé neutral sobre sesgos');
  });
});
