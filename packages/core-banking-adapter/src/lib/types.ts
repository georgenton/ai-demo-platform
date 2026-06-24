// -----------------------------------------------------------------------------
// Tipos del CoreBankingAdapter (ADR-0020).
//
// Abstracción sobre el sistema bancario "core" que usa la cooperativa para
// gestionar socios, cuentas y préstamos. En producción es un sistema real
// (Cobis, Conexus, Compac, SQL Server propio, etc); en este demo es el
// MockCoreBankingAdapter con datos sembrados.
//
// El LLM nunca llama directamente al adapter — pasa por las tools del
// LoansModule (consultCoreBanking, createLoanRequest, etc) que sí lo
// usan. Esto permite añadir logging, rate limiting y validación cruzada
// sin tocar el adapter.
// -----------------------------------------------------------------------------

/**
 * Proveedores soportados de core bancario.
 *
 *   - `mock`: implementación con datos sembrados (sub-PR 1). Sirve para
 *     todos los demos sin requerir infra externa.
 *   - `cobis`: futuro adapter real para Cobis (uno de los cores más
 *     usados en CACs ecuatorianas). Stub por ahora.
 *
 * Cuando un cliente real firme y use otro core, se suma acá y se
 * implementa el provider. El resto del sistema se entera por tipos.
 */
export type CoreBankingProvider = 'mock' | 'cobis';

/**
 * Información de un socio de la cooperativa tal como vive en el core
 * bancario. Lo mínimo que el bot necesita saber para conversar y para
 * pre-calificar un préstamo.
 */
export interface MemberInfo {
  /** ID interno del socio en el core. */
  memberId: string;
  /** Nombre completo registrado. */
  fullName: string;
  /** Cédula ecuatoriana — 10 dígitos. */
  idNumber: string;
  /** Fecha en la que se hizo socio de la cooperativa. */
  joinedAt: Date;
  /**
   * Aporte de capital — en CACs el socio debe tener un mínimo de aporte
   * (típicamente $20 USD) para ser elegible a préstamos. Decimal en
   * string para evitar imprecisión de floats al cruzar la frontera del
   * adapter.
   */
  shareCapital: string;
  /** Si tiene un préstamo activo (en etapa `servicing`). */
  hasActiveLoan: boolean;
}

/**
 * Historial crediticio resumido. Lo que la tool
 * `calculateLoanEligibility` necesita para dar veredicto sin pedirle
 * más datos al socio.
 */
export interface CreditHistory {
  /** Score interno de la cooperativa, 0-1000. >= 600 suele ser elegible. */
  internalScore: number;
  /** Ingreso mensual reportado en USD. */
  monthlyIncome: string;
  /** Cuota total que paga el socio por otras deudas en USD. */
  monthlyDebt: string;
  /**
   * Fecha del último préstamo que el socio cerró sin mora. Null si nunca
   * tuvo. Las CACs valoran historial: un socio con préstamos pagados
   * tiene mejor scoring efectivo.
   */
  lastLoanClosedAt: Date | null;
}

/**
 * Input para crear una nueva solicitud de préstamo en el core. El
 * adapter devuelve un requestId que se persiste en `LoanLead.coreRequestId`
 * para consultas posteriores.
 */
export interface LoanRequestInput {
  memberId: string;
  amountUsd: string;
  termMonths: number;
  purpose: string;
  /** Tasa de interés anual ofertada al socio, en porcentaje (ej. 14.5). */
  annualInterestRate: number;
}

/**
 * Etapas que el core conoce sobre la solicitud. NO es 1:1 con
 * `LoanStage` de Prisma — el core tiene su propio vocabulario.
 *
 * El adapter es el lugar donde se traduce entre los dos vocabularios.
 */
export type CoreLoanStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'disbursed'
  | 'active'
  | 'rejected'
  | 'cancelled';

/**
 * Resumen del estado de una solicitud existente en el core.
 */
export interface CoreLoanState {
  requestId: string;
  status: CoreLoanStatus;
  approvedAmount: string | null;
  approvedRate: number | null;
  disbursedAt: Date | null;
  notes: string | null;
}

/**
 * Interfaz uniforme. Cualquier provider implementa estos 5 métodos. El
 * caller (LoansModule en sub-PR 2) nunca se entera de qué provider tiene
 * abajo.
 */
export interface CoreBankingAdapter {
  /**
   * Busca un socio por cédula. Devuelve null si no existe — el flujo
   * típico es: bot pide cédula → llama a verifyMember → si null pide
   * confirmación al socio + sugiere registrarse en oficina.
   */
  verifyMember(input: { idNumber: string }): Promise<MemberInfo | null>;

  /**
   * Consulta el historial crediticio del socio. Lanza si el memberId no
   * existe — el caller debería haber llamado verifyMember antes.
   */
  getCreditHistory(memberId: string): Promise<CreditHistory>;

  /**
   * Registra una solicitud de préstamo en el core. Devuelve el id que
   * el caller persiste como coreRequestId del LoanLead.
   */
  createLoanRequest(input: LoanRequestInput): Promise<{ requestId: string }>;

  /**
   * Trae el estado actual de una solicitud previamente creada.
   */
  getLoanRequest(requestId: string): Promise<CoreLoanState | null>;

  /**
   * Cambia el status de una solicitud en el core. Permite que el flujo
   * del demo "anuncie" al core que la solicitud avanzó (ej. el bot
   * mueve al lead a `approval` → llama updateLoanRequest con
   * status='approved'). En producción esto podría dispararse desde el
   * comité humano, no el LLM.
   */
  updateLoanRequest(input: {
    requestId: string;
    status: CoreLoanStatus;
    notes?: string;
  }): Promise<void>;
}
