# anh-chat Architecture Plan

## Storage Layout (under `novel-helper/.anh-chat/`)

- `roles/index.json` — registry of all roles with minimal metadata (`uuid`, `name`, `type`, `packagePath`, `lastUpdatedAt`).
- `roles/<uuid>.json` — full role card serialized from the `Role` interface.
- `storylines/<uuid>/timeline.json` — optional array of story arcs for a role. Shared arcs may live under `storylines/shared/`.
- `memory/<uuid>/memory.json` — long-term memory store per role with sections `episodic`, `semantic`, `traits`, `goals`.
- `conversations/index.json` — summary list of conversations with `conversationId`, `roleUuid`, timestamps, labels.
- `conversations/<conversationId>.jsonl` — chat transcript lines (`conversationId`, `messageId`, `senderType`, `senderName`, `roleUuid?`, `model?`, `timestamp`, `content`).

## Services to Implement

- `RoleRegistry` — scan/load/save role files; expose CRUD and events.
- `StorylineRepository` — read/write timeline files, support search API.
- `RoleMemoryService` — manage episodic/semantic memories, merge updates, expose append/update helpers.
- `ConversationLogService` — create conversations, append messages, index management; triggers memory updates when needed.

## Integration Points

- Initialize services during extension activation and share via dependency container/context.
- Extend task creation flow to associate a `roleUuid` so `SYSTEM_PROMPT` can include role and memory context.
- Add commands/webview messages for updating roles, memories, and storylines.

## Next Milestones

1. Define shared types in `src/types/anh-chat.ts` (Role, RoleMemory, ConversationMessage, etc.).
2. Implement service stubs under `src/services/anh-chat/` using the layout above.
3. Wire services into activation and prompt generation to read role + memory data.

## Implementation Notes

- `RoleRegistry` now loads roles from `novel-helper/.anh-chat/roles` and exposes the first summary as the default role.
- `ClineProvider` resolves that default role on startup, caches role/storyline/memory via `getRolePromptData`, and passes the bundle into each new `Task`.
- `SYSTEM_PROMPT` renders the role section (`buildRolePromptSection`) ahead of core tool instructions so the model always sees character context.
- Sample data (`博丽灵梦`) lives under `novel-helper/.anh-chat/roles` and `storylines` to make end-to-end testing easy.
