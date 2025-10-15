# Conversation Loop Behavior

The chat task loop previously forced an extra request whenever the model ended a turn without calling any tools. This automatic retry surfaced as a "stuck" conversation in the UI: the assistant finished streaming, but the agent continued waiting for a tool invocation that never arrived.

As of this change, `src/core/task/Task.ts` no longer enqueues `formatResponse.noToolsUsed()` when no tool call is detected. Instead, the loop exits normally once streaming finishes, so the session hands control back to the user immediately.

Key considerations:
- The assistant can still choose to call tools; their results populate `userMessageContent`, which keeps the loop running.
- If the model provides only text, the stack remains empty and the task returns to idle state—matching user expectations.
- Error handling for malformed responses is unchanged; we only removed the artificial retry prompt.
- Follow-up questions no longer surface as "`ask_followup_question Result:`" rows. The `ask_followup_question` tool still forwards the user's answer back to the model, and the first tool call still consumes the single-tool slot—preventing other tools from running until the follow-up is resolved.

## Chat Mode Guidance

When the persona or mode is set to `chat`, the system prompt now reminds the assistant not to invoke the `attempt_completion` tool just to end normal conversation. Endless chat sessions should remain open-ended, so `attempt_completion` is reserved for explicit task or subtask workflows. This guidance lives in `src/core/prompts/system.ts` within the chat-mode rules block.

When investigating future regressions around "waiting" states, check whether new logic reintroduces forced re-tries in the task loop or blocks `userMessageContentReady` from resolving.
