# Anh-Chat System Prompt Notes

## Current Prompt Pipeline
- `Task.getSystemPrompt()` (src/core/task/Task.ts) calls `SYSTEM_PROMPT` with the active mode, provider state, and the cached `rolePromptData` that was fetched via `ClineProvider.getRolePromptData()`.
- `ClineProvider` gathers role metadata, storyline, and memory (RoleMemoryService) and passes it through when instantiating each `Task`.
- `SYSTEM_PROMPT` (src/core/prompts/system.ts) builds the final prompt by:
  1. Resolving the mode definition with `getModeSelection()` (built-in/custom modes).
  2. Optionally loading a `.roo/system-prompt-<mode>` file.
  3. Calling `generatePrompt(...)`, which stitches together: role definition, markdown rules, tool descriptions, capability lists, rules, objectives, custom instructions, etc.
  4. With our recent changes it inserts `buildRolePromptSection(rolePromptData)` prior to the default Roo sections, but the underlying mode instructions (`roleDefinition`, `customInstructions`) remain the stock “Roo” text.

## Pain Points
- Even with a selected role, the lead-in `roleDefinition` still says “You are Roo…”, so behaviour defaults to the code assistant persona.
- Mode/tool configuration is unchanged, so the agent always loads the same tool stack (read/edit/browser/command) that expects coding tasks.
- We need an override mechanism when `currentAnhRole` is not the default assistant.

## Proposed Direction
1. **Role-Aware Mode Overrides**
   - Introduce a helper (e.g. `applyRoleOverrides(modeSelection, rolePromptData)`) that can replace `roleDefinition` and `baseInstructions` before `generatePrompt` assembles the prompt.
   - For coding-capable chat personas, merge programming instructions with conversational ones; for pure chat roles, strip or soften the default coding directives.
   - Store override rules either inside the role card (e.g. `profile.modeOverrides`) or via a mapping service to keep JSON roles declarative.

2. **Toolset Tweaks**
   - When switching to a “chat-only” role, disable heavy code tools (`edit`, `command`) by requesting the `ask` mode or generating a custom mode with minimal groups.
   - For hybrid roles, retain code tools but layer in chat etiquette instructions.
   - Implementation idea: have `ClineProvider` choose a role-specific mode slug (e.g. `role.metadata.defaultMode ?? currentMode`) before task creation.

3. **Memory & Traits in Instructions**
   - Expand `buildRolePromptSection` to summarise traits/goals concisely and feed them into the override text (e.g. “Speak as <name>, a <type> who…”).
   - Provide hooks to append episodic memories as additional guidance.

4. **Configuration Surface**
   - Allow role JSON to declare:
     ```json
     {
       "modeOverrides": {
         "roleDefinition": "…",
         "customInstructions": "…",
         "defaultMode": "ask"
       },
       "toolGroups": ["read", "browser"]
     }
     ```
   - Fall back to global defaults when fields are absent.

5. **Validation & UX**
   - Show current persona/mode in the UI (e.g. badge under selector) so users know they switched out of coding mode.
   - Add tests covering prompt generation for coding/chat roles to catch regressions.

## Next Steps
1. Extend role schema (packages/types/src/anh-chat.ts) with optional `modeOverrides` and `toolGroups` metadata.
2. Update `RoleRegistry` / loader to surface override metadata alongside `RolePromptData`.
3. Modify `SYSTEM_PROMPT` to run `applyRoleOverrides` before composing `basePrompt`.
4. Adjust `ClineProvider` task creation to honour role-specific mode/tool choices.
5. Add unit tests around `buildRolePromptSection`, overrides, and `Task.getSystemPrompt()` for at least two sample roles (default assistant vs. chat persona).
