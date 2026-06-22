# VibeCAD Update Log

## Buildathon Pre-Release (June 22, 2025)

### Prompt System Expansion
- Expanded `cadquery-guide.txt` with 8 additional common pattern recipes (flange, pulley, bolt, shaft, hollow box, keyway, revolved profile, etc.)
- Curated 10 few-shot examples (8 positive, 2 negative) covering bracket, flange, pulley, shaft, bolt, washer, hollow cylinder, and enclosure patterns
- All examples validated against CadQuery 2.7.0 — removed deprecated methods (gearSpur, gearHelical) and topology-breaking patterns
- Prompt text files are subject to ongoing refinement as the model behavior and CadQuery API evolve

### Model Provider Configuration
- Added Xiaomi MiMo model family: `mimo-v2.5`, `mimo-v2.5-pro`, `mimo-v2.5-flash`
- Configured token limits: 8192 for Pro/Vision, 4096 for Flash
- Primary generation model: `mimo-v2.5-pro` (10M TPM, 100 RPM)
- Clarification agent: `mimo-v2.5` (temperature 0.1, max 1024 tokens)

### Proactive Clarification Agent
- Reintroduced the clarification pipeline that runs before code generation
- The agent analyzes user prompts and decides whether clarification questions are needed
- If ambiguous: emits up to 2 interactive questions with pre-filled options
- If clear: immediately returns a standardized prompt with inferred defaults
- Fallback behavior: if the clarifier response is malformed, returns a generic "What type of part?" question instead of failing silently
- Frontend `ClarificationMessage` and `ClarificationAnswers` components are fully functional

### Prompt Expander Service
- Added 15+ shape mappings for vague prompts (bolt, pulley, flange, shaft, knob, enclosure, washer, gear, etc.)
- If no dimensions are detected, appends "with reasonable default dimensions in millimeters"
- Runs before the clarification agent — fast, zero-cost preprocessing

### Error Handling & Retry Logic
- Fixed `BRep_API: command not done` error classification (was misclassified as `WIRE_TOPOLOGY`)
- Updated retry template with specific fix instructions per error type (FILLET_CHAMFER, BUILD_ORDER, SELECTOR, etc.)
- Reduced bracket example fillet radius from 3.0 to 1.5 (must be < half adjacent thickness for geometric validity)
- Executor variable name fix: changed from `r` to `result` to match system prompt requirements

### Parameter System Type Alignment
- Resolved schema mismatch between backend (sends `Record<string, ParameterSchema>`) and frontend (expected `Parameter[]`)
- Backend now consistently sends object format; frontend converts via `Object.entries()` where needed
- Parameter update flow (`/api/update-params`) handles both array and object responses for backward compatibility

### Frontend Provider Dropdown
- Filtered to only show providers with configured API keys
- Set `mimo-pro` as the default model
- Removed Fireworks models (DeepSeek, Qwen, Kimi, MiniMax, GLM) until API keys are configured
- Added descriptive labels showing RPM/TPM limits where applicable

### 0G Compute TEE Integration
- Added `ZG-Res-Key` header extraction from LLM responses
- Frontend renders a TEE verification badge (`🔒 TEE Verified`) when using 0G provider
- Proof structure is currently a placeholder awaiting full 0G SDK integration for cryptographic verification

### Files Modified
- `backend/ai-server/src/prompts/cadquery-guide.txt`
- `backend/ai-server/src/prompts/few-shot-examples.txt`
- `backend/ai-server/src/prompts/system-prompt.txt`
- `backend/ai-server/src/prompts/retry-user-message.txt`
- `backend/ai-server/src/prompts/prompt-expander.txt`
- `backend/ai-server/src/prompts/clarifier-prompt.txt`
- `backend/ai-server/src/config.ts`
- `backend/ai-server/src/services/llm.ts`
- `backend/ai-server/src/services/prompt-expander.ts`
- `backend/ai-server/src/routes/generate.ts`
- `backend/cad-server/src/executor.py`
- `frontend/src/types/index.ts`
- `frontend/src/App.tsx`
- `frontend/src/lib/constants.ts`
- `frontend/src/hooks/useParamUpdate.ts`

### Known Limitations
- `torus()` primitive creates zero-volume geometry in CadQuery 2.7.0 — recommend using revolve or sweep workarounds
- `parametricCurve` and `radiusArc` methods may not be available in all CadQuery versions
- 0G credits: 0.1 remaining (use sparingly for demo verification only)
- MiMo credits: sufficient for buildathon testing (100 RPM, 10M TPM)
- Prompt text files are subject to change as model behavior and geometric edge cases are discovered

---
