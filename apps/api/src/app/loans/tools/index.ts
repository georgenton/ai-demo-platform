// -----------------------------------------------------------------------------
// Barrel + array de tools — el LoansService importa LOAN_TOOLS de acá y
// lo pasa a chat.streamWithTools(). Centralizar el orden es importante
// porque algunos providers (Anthropic) priorizan tools por su posición.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

import { CALCULATE_LOAN_ELIGIBILITY_TOOL } from './calculate-eligibility.tool.js';
import { CONSULT_CORE_BANKING_TOOL } from './consult-core-banking.tool.js';
import { MOVE_TO_STAGE_TOOL } from './move-to-stage.tool.js';
import { REGISTER_LEAD_TOOL } from './register-lead.tool.js';
import { REQUEST_DOCUMENT_TOOL } from './request-document.tool.js';

export const LOAN_TOOLS: ChatTool[] = [
  REGISTER_LEAD_TOOL,
  REQUEST_DOCUMENT_TOOL,
  CONSULT_CORE_BANKING_TOOL,
  CALCULATE_LOAN_ELIGIBILITY_TOOL,
  MOVE_TO_STAGE_TOOL,
];

export * from './register-lead.tool.js';
export * from './request-document.tool.js';
export * from './consult-core-banking.tool.js';
export * from './calculate-eligibility.tool.js';
export * from './move-to-stage.tool.js';
