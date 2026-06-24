// -----------------------------------------------------------------------------
// Barrel + array de tools — el BiService importa BI_TOOLS y lo pasa a
// chat.streamWithTools.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

import { RENDER_CHART_TOOL } from './render-chart.tool.js';
import { RUN_SQL_TOOL } from './run-sql.tool.js';

export const BI_TOOLS: ChatTool[] = [RUN_SQL_TOOL, RENDER_CHART_TOOL];

export * from './run-sql.tool.js';
export * from './render-chart.tool.js';
