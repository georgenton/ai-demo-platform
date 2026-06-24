// Barrel del módulo de cliente HTTP. Re-exporta lo que el resto del frontend
// necesita importar, así los consumers escriben `from '@/lib/api'` y no
// `from '@/lib/api/<archivo>'` archivo por archivo.

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export { ApiError, ingestPdf, ingestText, subscribeToChat } from './client';
export { subscribeToCompare } from './compare';
export { subscribeToAgent, getAgentHistory } from './agent';
export {
  getClinicalPatients,
  getClinicalPatientDetail,
  getClinicalProtocols,
  subscribeToClinicalAnalyze,
} from './clinical';
export {
  getHrJobs,
  getHrJob,
  createHrInterview,
  getHrNextQuestion,
  recordHrAnswer,
  subscribeToHrFinalize,
} from './hr';
export {
  fetchCorpusPapers,
  fetchCorpusStats,
  subscribeToCorpusSearch,
  subscribeToCorpusSummary,
  uploadCorpusBatch,
} from './corpus';
export { listDemos, getDemo } from './demos';
export { subscribeToTutorChat, getTutorPricing } from './tutor';
export {
  uploadNotarize,
  listNotarized,
  getNotarized,
  verifyNotarized,
} from './notarize';
export {
  getLoan,
  listLoans,
  getLoanMetrics,
  subscribeToLoanChat,
} from './loans';
export { subscribeToBiChat } from './bi';
export {
  deleteDocument,
  getDocument,
  listDocumentChunks,
  listDocuments,
} from './documents';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export { useChatStream } from './use-chat-stream';
export {
  useClinicalAnalyze,
  type ClinicalAnalyzeEntry,
  type ClinicalAnalyzeStatus,
  type UseClinicalAnalyzeResult,
} from './use-clinical-analyze';
export {
  useInterviewSession,
  type InterviewPhase,
  type UseInterviewSessionResult,
} from './use-interview-session';
export { useCorpusPapers } from './use-corpus-papers';
export { useCorpusSearch } from './use-corpus-search';
export { useCorpusStats } from './use-corpus-stats';
export { useCorpusSummary } from './use-corpus-summary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ChatStreamStatus, UseChatStreamResult } from './use-chat-stream';
export type {
  CorpusPapersStatus,
  UseCorpusPapersResult,
} from './use-corpus-papers';
export type {
  CorpusSearchStatus,
  UseCorpusSearchResult,
} from './use-corpus-search';
export type {
  CorpusStatsStatus,
  UseCorpusStatsResult,
} from './use-corpus-stats';
export type {
  CorpusSummaryStatus,
  UseCorpusSummaryResult,
} from './use-corpus-summary';
export type {
  ApiErrorPayload,
  ChatQuery,
  ChatStreamHandlers,
  ChatSubscription,
  DemoId,
  IngestFileRequest,
  IngestResponse,
  IngestTextRequest,
} from './types';
export type {
  CompareRequest,
  CompareStreamHandlers,
  CompareSubscription,
} from './types-compare';
export type {
  AgentEvent,
  AgentHistoryEntry,
  AgentHistoryQuery,
  AgentHistoryResponse,
  AgentRequest,
  AgentStreamHandlers,
  AgentSubscription,
  DoneEvent,
  ErrorEvent,
  TokenEvent,
  ToolCallEvent,
  ToolErrorEvent,
  ToolResultEvent,
} from './types-agent';
export type {
  CorpusPaperItem,
  CorpusPapersQuery,
  CorpusPapersResponse,
  CorpusSearchHandlers,
  CorpusSearchQuery,
  CorpusSearchSubscription,
  CorpusStats,
  CorpusSummaryHandlers,
  CorpusSummarySubscription,
  CorpusUploadItem,
  CorpusUploadResponse,
  PapersByYearItem,
  TopTopicItem,
} from './types-corpus';
export type { DemoMetadata, DemoStatus } from './types-demos';
export type {
  ClinicalAnalyzeEvent,
  ClinicalAnalyzeRequest,
  ClinicalAnalyzeStreamHandlers,
  ClinicalAnalyzeSubscription,
  ClinicalConsultation,
  ClinicalDoneEvent,
  ClinicalErrorEvent,
  ClinicalInteraction,
  ClinicalInteractionSeverity,
  ClinicalListPatientsQuery,
  ClinicalListProtocolsQuery,
  ClinicalPatientDetail,
  ClinicalPatientListResponse,
  ClinicalPatientSummary,
  ClinicalProtocol,
  ClinicalProtocolListResponse,
  ClinicalTokenEvent,
  ClinicalToolCallEvent,
  ClinicalToolResultEvent,
} from './types-clinical';
export type {
  HrAnswerRequest,
  HrAnswerResponse,
  HrCreateInterviewRequest,
  HrCreateInterviewResponse,
  HrDimensionScored,
  HrDimensionScoredEvent,
  HrDoneEvent,
  HrErrorEvent,
  HrFinalEvent,
  HrFinalResult,
  HrFinalizeEvent,
  HrFinalizeStreamHandlers,
  HrFinalizeSubscription,
  HrJobListResponse,
  HrJobSummary,
  HrNextQuestionResponse,
  HrQuestion,
  HrScoringTone,
  HrTokenEvent,
} from './types-hr';
export type {
  TutorChatRequest,
  TutorHistoryTurn,
  TutorLevel,
  TutorNaiOnPrem,
  TutorPricingResponse,
  TutorProviderPricing,
  TutorScenario,
  TutorStreamEvent,
  TutorStreamHandlers,
  TutorSubscription,
  TutorUsage,
} from './types-tutor';
export type {
  AnalysisDimension,
  AnalysisRisk,
  AnchorProvider,
  AnchorStatus,
  AnchorSummary,
  DocumentAnalysis,
  NotarizedDocType,
  NotarizedDocument,
  NotarizeMode,
  NotarizeUploadInput,
  RiskSeverity,
  VerificationAnchor,
  VerificationResponse,
} from './types-notarize';
export type {
  EligibilityResult as LoanEligibilityResult,
  LoanChatDoneEvent,
  LoanChatErrorEvent,
  LoanChatEvent,
  LoanChatRequest,
  LoanChatStageChangedEvent,
  LoanChatStreamHandlers,
  LoanChatSubscription,
  LoanChatTokenEvent,
  LoanChatToolEvent,
  LoanFunnelMetrics,
  LoanLeadDto,
  LoanLeadListItem,
  LoanStage,
  LoanToolName,
} from './types-loans';
export type {
  BiChartSpec,
  BiChartType,
  BiChatChartEvent,
  BiChatDoneEvent,
  BiChatErrorEvent,
  BiChatEvent,
  BiChatRequest,
  BiChatRowsEvent,
  BiChatSqlEvent,
  BiChatStreamHandlers,
  BiChatSubscription,
  BiChatTokenEvent,
} from './types-bi';
export { BI_CHART_TYPES } from './types-bi';
export type {
  ChunkSummary,
  DocumentDetail,
  DocumentSummary,
  ListDocumentsQuery,
  ListDocumentsResponse,
} from './types-documents';
