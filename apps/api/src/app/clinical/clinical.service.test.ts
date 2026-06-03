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

import { buildSystemPrompt, ClinicalService } from './clinical.service.js';

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
});
