// -----------------------------------------------------------------------------
// Body del POST /api/v1/clinical/analyze.
//
// El médico selecciona un paciente y escribe una pregunta libre del estilo:
//   "¿Puedo recetarle amoxicilina?"
//   "¿Qué diagnóstico diferencial debo considerar dado este examen?"
//   "Resume su historia clínica de los últimos 12 meses"
//
// El backend resuelve el paciente, arma el contexto (alergias, condiciones
// crónicas, medicación actual, últimas N consultas) y se lo pasa al LLM con
// la herramienta `check_drug_interactions` disponible. Streaming SSE.
//
// `patientId` puede venir como cuid del seed (ej. "clxxx...") o como un id
// futuro de paciente real. El controller lo valida como string no vacío;
// el service hace el lookup contra Prisma y devuelve 404 si no existe.
// -----------------------------------------------------------------------------

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnalyzeRequestDto {
  @ApiProperty({
    description:
      'cuid del paciente cuyo contexto clínico se carga para el análisis. ' +
      'Debe pertenecer al tenant que el resolver de scope elige (hoy: ' +
      'tenant compartido `clinical-shared` para industria salud).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  patientId!: string;

  @ApiProperty({
    description:
      'Pregunta libre del médico. Lenguaje natural. El LLM la responde con ' +
      'la historia clínica + protocolos como contexto, y puede invocar la ' +
      'herramienta de interacciones medicamentosas si lo necesita.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  question!: string;
}
