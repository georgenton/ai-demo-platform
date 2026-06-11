// -----------------------------------------------------------------------------
// Tipos del Demo 08 (Notarización cooperativa) — espejo del backend.
//
// Los nombres replican `apps/api/src/app/notarize/dto/notarize.dto.ts`. Mantener
// sincronizados (ADR-0010 — sin paquete contracts).
// -----------------------------------------------------------------------------

export type NotarizedDocType =
  | 'assembly_minutes'
  | 'loan'
  | 'capital_contribution';

export type NotarizeMode = 'local' | 'public' | 'both';

export type AnchorProvider = 'local' | 'polygon';
export type AnchorStatus = 'confirmed' | 'pending' | 'failed';

export interface AnchorSummary {
  provider: AnchorProvider;
  anchorId: string;
  status: AnchorStatus;
  anchoredAt: string;
  explorerUrl?: string;
  errorMessage?: string;
}

export interface AnalysisDimension {
  key: string;
  label: string;
  value: string;
}

export type RiskSeverity = 'high' | 'medium' | 'low' | 'info';

export interface AnalysisRisk {
  severity: RiskSeverity;
  title: string;
  description: string;
}

export interface DocumentAnalysis {
  docType: NotarizedDocType;
  dimensions: AnalysisDimension[];
  risks: AnalysisRisk[];
  recommendations: string[];
  reasoning?: string;
}

export interface NotarizedDocument {
  documentId: string;
  name: string;
  docType: NotarizedDocType;
  contentHash: string;
  contentSize: number;
  createdAt: string;
  analysis: DocumentAnalysis | null;
  anchors: AnchorSummary[];
}

export interface NotarizeUploadInput {
  file: File;
  docType: NotarizedDocType;
  mode: NotarizeMode;
}

export interface VerificationAnchor {
  provider: AnchorProvider;
  anchorId: string;
  valid: boolean;
  reason?: string;
  details: Record<string, unknown>;
}

export interface VerificationResponse {
  documentId: string;
  anchors: VerificationAnchor[];
}
