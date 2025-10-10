# SillyTavern Preset Test Suite

This directory contains comprehensive tests for the SillyTavern preset parsing and injection functionality.

## Test Files Overview

### 1. `silly-tavern-preset.test.ts`
**Purpose**: Tests the schema validation and type safety of preset objects.
**Coverage**:
- STPresetPrompt schema validation
- STPresetOrderEntry schema validation
- STPreset schema validation
- Unknown field handling via catchall
- Real-world preset structure compatibility

### 2. `st-preset-injector.test.ts`
**Purpose**: Tests the core injection functionality.
**Coverage**:
- Preset detection (`looksLikeTavernPreset`)
- Preset parsing (`parseTavernPresetStrict`)
- Preset compilation (`compilePresetChannels`)
- Role injection (`injectCompiledPresetIntoRole`)
- End-to-end integration (`parseCompileAndInjectPreset`)
- Error handling and edge cases

### 3. `st-preset-integration.test.ts`
**Purpose**: Tests with real-world data and performance scenarios.
**Coverage**:
- Real preset file processing
- Performance with large datasets
- Memory and resource management
- Type safety validation
- Error resilience

### 4. `st-preset-performance.test.ts`
**Purpose**: Performance benchmarks and stress testing.
**Coverage**:
- Large preset handling (1000+ prompts)
- Complex nested structures
- Memory leak detection
- Concurrent operations
- Extreme value handling
- Performance baselines

### 5. `st-preset-examples.test.ts`
**Purpose**: Demonstrates practical usage patterns.
**Coverage**:
- Basic usage patterns (character enhancement, domain expertise)
- Advanced patterns (multi-character, custom mapping, progressive enhancement)
- Real-world scenarios (customer service bot, educational tutor)

## Key Test Scenarios

### Schema Validation
```typescript
// Minimal valid prompt
{ identifier: "test-prompt" }

// Complete prompt with all fields
{
  identifier: "complete-prompt",
  name: "Complete Test Prompt",
  role: "system",
  content: "This is a test prompt content",
  enabled: true,
  injection_position: 1,
  injection_depth: 2,
  injection_order: 100
}
```

### Preset Compilation
```typescript
// System prompts → compiled.system
// User prompts → compiled.user
// Assistant prompts → compiled.assistant
const compiled = compilePresetChannels(preset, {
  characterId: 100001,
  onlyEnabled: true
}, "\n\n")
```

### Role Injection
```typescript
// Default mapping: system→system_prompt, user→scenario, assistant→mes_example
const injected = parseCompileAndInjectPreset(
  baseRole,
  preset,
  { characterId: 1 },
  DEFAULT_INJECT_MAPPING
)
```

### Custom Mapping
```typescript
const customMapping = {
  systemTo: "creator_notes",
  userTo: "description",
  assistantTo: "post_history_instructions",
  joiner: "\n---\n"
}
```

## Performance Benchmarks

Current performance baselines (500 prompts):
- **Average**: ~1-3ms
- **Min**: 1ms
- **Max**: 2-6ms
- **Large preset (1000 prompts)**: <2 seconds
- **Extreme content (1MB prompt)**: <500ms

## Usage Examples

### Simple Character Enhancement
```typescript
const characterPreset = {
  prompts: [
    {
      identifier: "personality",
      role: "system",
      content: "You are exceptionally friendly and encouraging.",
      enabled: true
    }
  ],
  prompt_order: [{
    character_id: 1,
    order: [{ identifier: "personality", enabled: true }]
  }]
}

const enhancedRole = parseCompileAndInjectPreset(baseRole, characterPreset)
```

### Multi-Character System
```typescript
// character_id: 1 = Professional mode
// character_id: 2 = Casual mode
const professionalRole = parseCompileAndInjectPreset(
  baseRole,
  multiCharacterPreset,
  { characterId: 1 }
)
```

## Test Results

All tests are passing (59/59) with comprehensive coverage of:
- ✅ Schema validation and type safety
- ✅ Preset parsing and compilation
- ✅ Role injection and mapping
- ✅ Performance and memory management
- ✅ Real-world integration scenarios
- ✅ Error handling and edge cases

## Running Tests

```bash
# Run all ST preset tests
npm test -- src/__tests__/st-preset-*.test.ts

# Run specific test file
npm test -- src/__tests__/silly-tavern-preset.test.ts
npm test -- src/__tests__/st-preset-injector.test.ts
```

## Implementation Files

The tests cover the following implementation files:
- `silly-tavern-preset.ts` - Schema definitions and types
- `st-preset-injector.ts` - Parsing, compilation, and injection logic