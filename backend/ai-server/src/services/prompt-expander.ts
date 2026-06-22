/**
 * Simple rule-based prompt expander that adds default dimensions to vague prompts.
 * This is used before sending to the LLM to improve first-shot success rate.
 */

const EXPANSION_RULES: Array<{ pattern: RegExp; expansion: string }> = [
  { pattern: /^\s*a\s+gear\s*$/i, expansion: 'a spur gear with 12 teeth, module 2, 10mm thickness' },
  { pattern: /^\s*a\s+box\s*$/i, expansion: 'a 100x60x40mm box with 2mm wall thickness' },
  { pattern: /^\s*a\s+bracket\s*$/i, expansion: 'a right-angle bracket 80x50x5mm with 4 mounting holes' },
  { pattern: /^\s*a\s+pulley\s*$/i, expansion: 'a pulley with 80mm diameter, 20mm width, 10mm bore' },
  { pattern: /^\s*a\s+washer\s*$/i, expansion: 'a flat washer OD 25mm, ID 10mm, 2mm thick' },
  { pattern: /^\s*a\s+flange\s*$/i, expansion: 'a pipe flange 150mm OD, 100mm ID, 10mm thick with 8 bolt holes on 125mm PCD' },
  { pattern: /^\s*a\s+shaft\s*$/i, expansion: 'a cylindrical shaft 30mm diameter, 150mm length with a keyway' },
  { pattern: /^\s*a\s+knob\s*$/i, expansion: 'a round knob 40mm diameter, 25mm height with a D-shaped shaft hole' },
  { pattern: /^\s*a\s+spring\s*$/i, expansion: 'a compression spring, wire diameter 2mm, coil diameter 20mm, 10 coils, free height 50mm' },
  { pattern: /^\s*a\s+mug\s*$/i, expansion: 'a cylindrical coffee mug 100mm tall, 80mm diameter with a handle' },
  { pattern: /^\s*a\s+bottle\s*$/i, expansion: 'a bottle with 50mm body diameter, 120mm height, 20mm neck diameter' },
  { pattern: /^\s*a\s+bolt\s*$/i, expansion: 'an M10 bolt 50mm long with a hex head' },
  { pattern: /^\s*a\s+nut\s*$/i, expansion: 'an M10 hex nut 15mm across flats, 8mm thick' },
  { pattern: /^\s*a\s+pipe\s*$/i, expansion: 'a pipe with 50mm inner diameter, 3mm wall thickness, 200mm length' },
  { pattern: /^\s*a\s+plate\s*$/i, expansion: 'a flat mounting plate 100x80mm, 5mm thick with 4 holes' },
];

export function expandPrompt(prompt: string): string {
  const trimmed = prompt.trim().toLowerCase();
  
  // Check for exact matches first
  for (const rule of EXPANSION_RULES) {
    if (rule.pattern.test(trimmed)) {
      console.log(`[PROMPT EXPANDER] "${prompt}" → "${rule.expansion}"`);
      return rule.expansion;
    }
  }
  
  // If no dimensions given at all, append a hint
  const hasNumbers = /\d/.test(prompt);
  if (!hasNumbers) {
    const expanded = `${prompt} with reasonable default dimensions`;
    console.log(`[PROMPT EXPANDER] No dimensions found, appending hint: "${expanded}"`);
    return expanded;
  }
  
  // Otherwise, return as-is (has dimensions)
  return prompt;
}

/**
 * Check if a prompt likely contains an image reference.
 */
export function hasImageReference(prompt: string): boolean {
  const imageKeywords = ['image', 'photo', 'picture', 'sketch', 'drawing', 'model this', 'from image'];
  return imageKeywords.some(kw => prompt.toLowerCase().includes(kw));
}
