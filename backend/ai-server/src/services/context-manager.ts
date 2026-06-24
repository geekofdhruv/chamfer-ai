import type OpenAI from 'openai';

function estimateTokens(text: string): number {
  // Simple heuristic: ~3.5 chars per token for English + code mixed
  return Math.ceil(text.length / 3.5);
}

function estimateMessageTokens(msg: OpenAI.Chat.Completions.ChatCompletionMessageParam): number {
  const content = msg.content;
  if (typeof content === 'string') {
    return estimateTokens(content);
  }
  if (!content || !Array.isArray(content)) {
    return 0;
  }
  // Array content (images + text)
  let tokens = 0;
  for (const part of content) {
    if (part.type === 'text') {
      tokens += estimateTokens(part.text);
    } else if (part.type === 'image_url') {
      tokens += 1000; // Approximate vision token cost per image
    }
  }
  return tokens;
}

interface TruncateOptions {
  systemPrompt: string;
  maxTokens: number;
  preserveLastNTurns?: number; // number of user+assistant pairs to always keep
}

/**
 * Truncates message history to fit within a token budget.
 * Strategy:
 * 1. Always keep system prompt
 * 2. Always keep last N user+assistant pairs (preserveLastNTurns)
 * 3. Summarize older messages if they don't fit
 */
export function truncateHistory(
  history: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: TruncateOptions
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const { systemPrompt, maxTokens, preserveLastNTurns = 2 } = options;

  const systemTokens = estimateTokens(systemPrompt);
  const budget = maxTokens - systemTokens;

  if (budget <= 0) {
    console.warn('[CONTEXT] System prompt alone exceeds token budget');
    return [{ role: 'system', content: systemPrompt }];
  }

  // Separate system message from history
  const nonSystemMessages = history.filter(m => m.role !== 'system');
  const systemMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = { role: 'system', content: systemPrompt };

  // Calculate tokens for recent messages (last N pairs)
  const lastNMessages = nonSystemMessages.slice(-preserveLastNTurns * 2);
  const lastNTokens = lastNMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);

  // Older messages
  const olderMessages = nonSystemMessages.slice(0, -preserveLastNTurns * 2);

  if (olderMessages.length === 0) {
    // No older messages to worry about
    return [systemMsg, ...lastNMessages];
  }

  const olderTokens = olderMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  const totalWithAll = systemTokens + olderTokens + lastNTokens;

  if (totalWithAll <= maxTokens) {
    // Everything fits
    return [systemMsg, ...olderMessages, ...lastNMessages];
  }

  // Need to summarize older messages
  const remainingBudget = budget - lastNTokens;
  if (remainingBudget <= 0) {
    // Can't even fit the last N turns + system prompt
    console.warn('[CONTEXT] Last N turns alone exceed budget, keeping only recent messages');
    return [systemMsg, ...lastNMessages];
  }

  // Summarize older messages into a compact context
  const summary = summarizeMessages(olderMessages, remainingBudget);
  const summaryMsg: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
    role: 'system',
    content: summary,
  };

  return [systemMsg, summaryMsg, ...lastNMessages];
}

/**
 * Summarizes old conversation history into a compact text.
 */
function summarizeMessages(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  maxChars: number
): string {
  const parts: string[] = [];
  parts.push('Previous conversation history (summarized):');

  // Extract code attempts and errors
  let codeAttempts = 0;
  const errors: string[] = [];
  const descriptions: string[] = [];

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      codeAttempts++;
      try {
        const content = typeof msg.content === 'string' ? msg.content : '';
        const parsed = JSON.parse(content);
        if (parsed.description) {
          descriptions.push(parsed.description);
        }
        if (parsed.code) {
          // Extract first line as summary
          const firstLine = parsed.code.split('\n')[0].trim();
          if (firstLine) {
            parts.push(`Generated: ${firstLine}`);
          }
        }
      } catch {
        // Not JSON, skip
      }
    } else if (msg.role === 'user') {
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (content.includes('error') || content.includes('Error') || content.includes('fix') || content.includes('Fix')) {
        errors.push(content.slice(0, 100));
      }
    }
  }

  if (codeAttempts > 0) {
    parts.push(`Total code generation attempts: ${codeAttempts}`);
  }
  if (descriptions.length > 0) {
    parts.push(`Previous designs: ${descriptions.slice(-2).join('; ')}`);
  }
  if (errors.length > 0) {
    parts.push(`Previous errors encountered: ${errors.slice(-2).join('; ')}`);
  }

  let summary = parts.join('\n');

  // Truncate if too long
  if (summary.length > maxChars) {
    summary = summary.slice(0, maxChars - 50) + '... [truncated]';
  }

  return summary;
}

/**
 * Logs token counts for debugging.
 */
export function logTokenCounts(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  label: string
): void {
  let total = 0;
  const breakdown: string[] = [];
  for (const msg of messages) {
    const tokens = estimateMessageTokens(msg);
    total += tokens;
    const preview = typeof msg.content === 'string'
      ? msg.content.slice(0, 40)
      : Array.isArray(msg.content)
      ? `[${msg.content.length} parts]`
      : '[no content]';
    breakdown.push(`${msg.role}: ${tokens} tokens (${preview}...)`);
  }
  console.log(`[CONTEXT] ${label} — ${total} total tokens:`);
  for (const line of breakdown) {
    console.log(`  ${line}`);
  }
}

/**
 * Gets the max context tokens for a provider.
 */
export function getMaxContextTokens(providerId: string): number {
  const budgets: Record<string, number> = {
    'mimo': 100000,
    'mimo-pro': 100000,
    '0g': 40000,
    'groq': 6000,
    'groq-vision': 6000,
    'deepseek-v4-flash': 100000,
    'deepseek-v4-pro': 100000,
    'qwen3p7-plus': 100000,
    'kimi-k2p6': 100000,
    'minimax-m3': 100000,
    'glm-5p1': 100000,
    'glm-5p2': 100000,
  };
  return budgets[providerId] || 100000;
}
