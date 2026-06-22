import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname);

export function readPromptFile(filename: string): string {
  const filePath = path.join(PROMPTS_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error(`[PROMPT LOADER] Failed to read ${filename}:`, e);
    return '';
  }
}

/**
 * Assembles the complete system prompt from individual prompt files.
 * Order: cadquery-guide → few-shot-examples → system-prompt (glue/rules)
 */
export function assembleSystemPrompt(): string {
  const guide = readPromptFile('cadquery-guide.txt');
  const examples = readPromptFile('few-shot-examples.txt');
  const skeleton = readPromptFile('system-prompt.txt');

  const parts = [
    guide,
    '\n\n--- FEW-SHOT EXAMPLES ---\n\n',
    examples,
    '\n\n--- SYSTEM RULES ---\n\n',
    skeleton,
  ];

  const fullPrompt = parts.join('');
  console.log(`[PROMPT LOADER] Assembled system prompt: ${fullPrompt.length} chars (${guide.length} guide + ${examples.length} examples + ${skeleton.length} rules)`);
  return fullPrompt;
}

/**
 * Reads the retry user message template for error corrections.
 */
export function getRetryTemplate(): string {
  return readPromptFile('retry-user-message.txt');
}

/**
 * Reads the prompt expansion rules for pre-processing user prompts.
 */
export function getPromptExpanderRules(): string {
  return readPromptFile('prompt-expander.txt');
}

/**
 * The fully assembled system prompt (cached after first read).
 */
export const FINAL_SYSTEM_PROMPT = assembleSystemPrompt();
export const RETRY_TEMPLATE = getRetryTemplate();
export const PROMPT_EXPANDER_RULES = getPromptExpanderRules();
