import { describe, it, expect } from 'vitest';
import { extractPythonCode, extractClarification, classifyError, buildInspectionFeedback } from '../src/services/llm';

describe('extractPythonCode', () => {
  it('extracts from ```python block', () => {
    expect(extractPythonCode('```python\nimport cadquery as cq\nr = cq.Workplane("XY")\n```'))
      .toBe('import cadquery as cq\nr = cq.Workplane("XY")');
  });

  it('extracts from \\boxed block', () => {
    expect(extractPythonCode('\\boxed{```python\ncorrect\n```}')).toBe('correct');
  });

  it('prefers boxed over regular', () => {
    expect(extractPythonCode('```python\nwrong\n```\n\\boxed{```python\ncorrect\n```}')).toBe('correct');
  });

  it('returns trimmed text when no block', () => {
    expect(extractPythonCode('  just text  ')).toBe('just text');
  });

  it('handles empty block', () => {
    expect(extractPythonCode('```python\n\n```')).toBe('');
  });

  it('handles multiline code', () => {
    const input = '```python\nimport cadquery as cq\nr = cq.Workplane("XY").rect(60, 40).extrude(5)\n```';
    expect(extractPythonCode(input)).toContain('.extrude(5)');
  });
});

describe('extractClarification', () => {
  it('returns null when no clarify block', () => {
    expect(extractClarification('No clarification here')).toBeNull();
  });

  it('extracts structured clarification with options', () => {
    const input = '```clarify\n{"questions": [{"question": "What diameter?", "key": "diameter", "options": ["5mm", "10mm", "15mm"], "default": "10mm"}]}\n```';
    const result = extractClarification(input);
    expect(result).toHaveLength(1);
    expect(result![0].question).toBe('What diameter?');
    expect(result![0].key).toBe('diameter');
    expect(result![0].options).toEqual(['5mm', '10mm', '15mm']);
    expect(result![0].default).toBe('10mm');
  });

  it('extracts legacy format (string array)', () => {
    const input = '```clarify\n{"questions": ["What size?", "How many?"]}\n```';
    const result = extractClarification(input);
    expect(result).toHaveLength(2);
    expect(result![0].question).toBe('What size?');
    expect(result![0].options).toEqual([]);
  });

  it('limits to 5 questions', () => {
    const questions = Array.from({ length: 10 }, (_, i) => ({
      question: `Q${i}`, key: `q${i}`, options: ['a'], default: 'a',
    }));
    const input = '```clarify\n' + JSON.stringify({ questions }) + '\n```';
    const result = extractClarification(input);
    expect(result).toHaveLength(5);
  });

  it('returns null for invalid JSON', () => {
    expect(extractClarification('```clarify\n{invalid json}\n```')).toBeNull();
  });
});

describe('classifyError', () => {
  it('classifies BUILD_ORDER errors', () => {
    const result = classifyError('No pending wires present');
    expect(result.category).toBe('BUILD_ORDER');
    expect(result.priority).toBe('critical');
  });

  it('classifies FILLET_CHAMFER errors', () => {
    const result = classifyError('No suitable edges for fillet');
    expect(result.category).toBe('FILLET_CHAMFER');
    expect(result.priority).toBe('high');
  });

  it('classifies BOOLEAN_FAILURE errors', () => {
    const result = classifyError('Null TopoDS_Shape in boolean operation');
    expect(result.category).toBe('BOOLEAN_FAILURE');
    expect(result.priority).toBe('critical');
  });

  it('classifies COMPOUND_ITERABLE errors', () => {
    const result = classifyError('compound() must be an iterable');
    expect(result.category).toBe('COMPOUND_ITERABLE');
    expect(result.priority).toBe('critical');
  });

  it('classifies NO_START_POINT errors', () => {
    const result = classifyError('No start point specified - cannot close');
    expect(result.category).toBe('NO_START_POINT');
    expect(result.priority).toBe('critical');
  });

  it('classifies API_ERROR for cq.math', () => {
    const result = classifyError("module 'cadquery' has no attribute 'math'");
    expect(result.category).toBe('API_ERROR');
    expect(result.priority).toBe('high');
  });

  it('classifies MISSING_R errors', () => {
    const result = classifyError("'r' not in dir()");
    expect(result.category).toBe('MISSING_R');
    expect(result.priority).toBe('critical');
  });

  it('classifies IMPORT_ERROR', () => {
    const result = classifyError('ModuleNotFoundError: No module named numpy');
    expect(result.category).toBe('IMPORT_ERROR');
    expect(result.priority).toBe('medium');
  });

  it('returns UNKNOWN for unrecognized errors', () => {
    const result = classifyError('Some completely unknown error');
    expect(result.category).toBe('UNKNOWN');
    expect(result.priority).toBe('medium');
  });
});

describe('buildInspectionFeedback', () => {
  it('returns empty string for null inspection', () => {
    expect(buildInspectionFeedback(null)).toBe('');
  });

  it('returns empty string when no errors or warnings', () => {
    expect(buildInspectionFeedback({ errors: [], warnings: [] })).toBe('');
  });

  it('formats errors', () => {
    const result = buildInspectionFeedback({
      errors: ['Model has zero volume', 'Invalid B-rep'],
      warnings: [],
    });
    expect(result).toContain('Geometry inspection found errors');
    expect(result).toContain('Model has zero volume');
    expect(result).toContain('Invalid B-rep');
  });

  it('formats warnings', () => {
    const result = buildInspectionFeedback({
      errors: [],
      warnings: ['Model is very large'],
    });
    expect(result).toContain('Geometry inspection warnings');
    expect(result).toContain('Model is very large');
  });

  it('combines errors and warnings', () => {
    const result = buildInspectionFeedback({
      errors: ['Zero volume'],
      warnings: ['Large model'],
    });
    expect(result).toContain('Zero volume');
    expect(result).toContain('Large model');
    expect(result).toContain('Fix the code');
  });
});
