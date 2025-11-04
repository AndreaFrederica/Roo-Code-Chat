# Mixin System Migration Guide

## Overview

This guide explains how to migrate from the old mixin system to the new JSON-based mixin system. The new system eliminates dynamic require operations and provides better performance, security, and maintainability.

## Key Changes

### 1. JSON-based Storage
- **Old**: Mixin rules stored in TypeScript files with dynamic imports
- **New**: All mixin rules stored in JSON format with static loading

### 2. Template-based Generation
- **Old**: Hardcoded mixin templates in separate files
- **New**: Centralized template generator with built-in templates

### 3. No Dynamic Requires
- **Old**: Used dynamic require() to load mixin files
- **New**: Uses static imports and JSON parsing

### 4. Independent File Structure
- **Old**: Mixed concerns in existing files
- **New**: Dedicated files for each component

## New File Structure

```
webview-ui/src/utils/
├── mixinTemplateGenerator.ts  # Template generation logic
├── mixinStorage.ts           # Storage management
├── mixinProcessor.ts         # Processing logic
└── hooks/
    └── useMixinSystem.ts     # React integration hook
```

## Migration Steps

### Step 1: Update Imports

Replace old imports:

```typescript
// OLD
import { DEFAULT_REGEX_RULES } from '@/components/common/builtin-regex-rules'
import { DEFAULT_AST_RULES } from '@/components/common/builtin-ast-rules'

// NEW
import { mixinTemplateGenerator } from '@/utils/mixinTemplateGenerator'
import { mixinStorageManager } from '@/utils/mixinStorage'
import { mixinProcessor } from '@/utils/mixinProcessor'
import { useMixinSystem } from '@/hooks/useMixinSystem'
```

### Step 2: Replace Direct Rule Access

```typescript
// OLD
const regexRules = DEFAULT_REGEX_RULES
const astRules = DEFAULT_AST_RULES

// NEW
const regexTemplate = mixinTemplateGenerator.getTemplate('builtin-regex')
const astTemplate = mixinTemplateGenerator.getTemplate('builtin-ast')
const regexRules = regexTemplate?.templates || {}
const astRules = astTemplate?.templates || {}
```

### Step 3: Update Component Logic

Replace direct mixin processing with hook-based approach:

```typescript
// OLD
const processContent = (content: string) => {
  // Direct processing with rules
  let result = content
  for (const [key, rule] of Object.entries(regexRules)) {
    if (rule.enabled) {
      const regex = new RegExp(rule.pattern, rule.flags)
      result = result.replace(regex, rule.replacement || '')
    }
  }
  return result
}

// NEW
const MyComponent = () => {
  const { processWithRegexMixins, loading, error } = useMixinSystem({
    defaultContext: {
      contentType: 'markdown',
      stage: 'ai-output'
    }
  })

  const handleProcessContent = async (content: string) => {
    const result = await processWithRegexMixins(content)
    return result.processed
  }

  // ... rest of component
}
```

### Step 4: Update Settings Components

Replace old mixin settings with new storage-based approach:

```typescript
// OLD
const [customRules, setCustomRules] = useState<RegexRulesConfig>({})

// NEW
const {
  entries,
  createEntry,
  updateEntry,
  deleteEntry,
  toggleEntry
} = useMixinSystem()

// Filter to regex entries only
const regexEntries = entries.filter(entry => entry.type === 'regex')
```

## API Reference

### MixinTemplateGenerator

```typescript
// Get built-in templates
const regexTemplate = mixinTemplateGenerator.getTemplate('builtin-regex')
const astTemplate = mixinTemplateGenerator.getTemplate('builtin-ast')

// Create custom template
const customTemplate = mixinTemplateGenerator.createCustomTemplate(
  'my-custom',
  'regex',
  'My Custom Regex Mixins',
  'Custom regex processing rules',
  {
    myRule: {
      enabled: true,
      description: 'My custom rule',
      pattern: '\\b(custom)\\b',
      flags: 'gi',
      action: 'highlight'
    }
  }
)
```

### MixinStorageManager

```typescript
// Create new entry
const entry = await mixinStorageManager.createEntry(
  'my-rule',
  'regex',
  {
    pattern: '\\b(test)\\b',
    flags: 'gi',
    action: 'replace',
    replacement: 'TEST'
  },
  {
    description: 'Test rule',
    enabled: true
  }
)

// Update existing entry
await mixinStorageManager.updateEntry(entry.id, {
  name: 'Updated Test Rule',
  enabled: false
})

// Search entries
const results = mixinStorageManager.searchEntries('test')
```

### MixinProcessor

```typescript
// Process content
const result = await mixinProcessor.processWithRegexMixins(
  'This is a test content',
  {
    contentType: 'markdown',
    stage: 'pre-processing',
    variables: { timestamp: new Date().toISOString() }
  },
  ['regex-rule-id-1', 'regex-rule-id-2']
)

console.log(result.processed) // Processed content
console.log(result.modifications) // Array of applied modifications
console.log(result.metadata.processingTime) // Processing time in ms
```

### useMixinSystem Hook

```typescript
const {
  entries,                    // All mixin entries
  loading,                   // Loading state
  error,                     // Error message

  // CRUD operations
  createEntry,               // Create new mixin entry
  updateEntry,               // Update existing entry
  deleteEntry,               // Delete entry
  toggleEntry,               // Enable/disable entry

  // Processing operations
  processContent,            // Process with all mixins
  processWithRegexMixins,    // Process with regex mixins only
  processWithAstMixins,      // Process with AST mixins only

  // Template operations
  getTemplate,               // Get built-in template
  createCustomTemplate,      // Create custom template

  // Utilities
  searchEntries,             // Search entries
  exportEntries,             // Export to JSON
  importEntries,             // Import from JSON

  statistics,                // Storage statistics
  refresh                    // Refresh from storage
} = useMixinSystem({
  autoInitialize: true,
  defaultContext: {
    contentType: 'markdown',
    stage: 'ai-output'
  }
})
```

## Migration Checklist

- [ ] Update all imports from old mixin files
- [ ] Replace direct rule access with template generator
- [ ] Update components to use useMixinSystem hook
- [ ] Replace custom rule state management with storage manager
- [ ] Update processing logic to use mixin processor
- [ ] Test all mixin functionality
- [ ] Update documentation and comments
- [ ] Remove old mixin files (if no longer needed)

## Backward Compatibility

The new system is designed to be backward compatible where possible:

1. **Rule Structure**: The core rule structure remains similar
2. **Processing Logic**: Basic processing logic works the same way
3. **API Consistency**: Method names follow similar patterns

However, some breaking changes exist:

1. **Storage Format**: Changed from TypeScript objects to JSON storage
2. **Template Access**: Changed from direct imports to template generator
3. **Processing Context**: Requires explicit context specification

## Performance Improvements

The new system provides several performance benefits:

1. **Static Loading**: No dynamic require operations
2. **Lazy Loading**: Templates loaded on-demand
3. **Caching**: Built-in caching for templates and storage
4. **Batch Processing**: Efficient batch processing of multiple rules

## Security Improvements

1. **No Dynamic Code**: Eliminates dynamic require security risks
2. **Validated Input**: All JSON input is validated
3. **Sandboxed Processing**: Rule processing is isolated
4. **Controlled Access**: Explicit API for storage operations

## Troubleshooting

### Common Issues

1. **Template Not Found**
   ```typescript
   // Check if template exists
   const template = mixinTemplateGenerator.getTemplate('builtin-regex')
   if (!template) {
     console.error('Template not found')
   }
   ```

2. **Storage Not Initialized**
   ```typescript
   // Ensure storage is initialized
   await mixinStorageManager.initialize()
   ```

3. **Processing Context Missing**
   ```typescript
   // Provide default context
   const result = await mixinProcessor.processWithRegexMixins(content, {
     contentType: 'markdown',
     stage: 'ai-output'
   })
   ```

### Debug Mode

Enable debug logging:

```typescript
// Enable debug mode in development
if (process.env.NODE_ENV === 'development') {
  console.log('[MixinSystem] Debug mode enabled')
}
```

## Examples

### Basic Usage

```typescript
import { useMixinSystem } from '@/hooks/useMixinSystem'

const MyComponent = () => {
  const { processContent, loading } = useMixinSystem()

  const handleProcess = async () => {
    const result = await processContent('Sample content')
    console.log('Processed:', result.processed)
  }

  return (
    <button onClick={handleProcess} disabled={loading}>
      Process Content
    </button>
  )
}
```

### Custom Mixin Creation

```typescript
const createCustomMixin = async () => {
  const { createEntry } = useMixinSystem()

  await createEntry(
    'emoji-enhancer',
    'regex',
    {
      pattern: ':([a-z]+):',
      flags: 'g',
      action: 'replace',
      replacement: (match: string, emoji: string) => {
        // Simple emoji mapping
        const emojiMap: Record<string, string> = {
          smile: '😊',
          heart: '❤️',
          thumbsup: '👍'
        }
        return emojiMap[emoji] || match
      }
    },
    {
      description: 'Enhance text with emojis',
      enabled: true
    }
  )
}
```

### Advanced Processing

```typescript
const advancedProcessing = async (content: string) => {
  const { processContent } = useMixinSystem()

  const result = await processContent(content, {
    contentType: 'markdown',
    stage: 'ai-output',
    variables: {
      timestamp: new Date().toISOString(),
      user: 'John Doe'
    },
    metadata: {
      source: 'ai-chat',
      model: 'gpt-4'
    }
  }, [
    'custom-regex-1',
    'builtin-ast-1'
  ])

  return result
}
```