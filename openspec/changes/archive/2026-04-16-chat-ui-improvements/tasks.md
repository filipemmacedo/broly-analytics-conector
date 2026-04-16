## 1. URL-Based Session Routing

- [x] 1.1 Create `src/app/chat/[id]/page.tsx` as the chat page, rendering `<Dashboard />` wrapped in `<ChatSessionProvider initialChatId={params.id}>`.
- [x] 1.2 Update `src/app/page.tsx` to be a server component that fetches `/api/chats`, picks the most recent session (or creates one via `POST /api/chats`), and calls `redirect(\`/chat/${id}\`)`.
- [x] 1.3 Update `ChatSessionProvider` to accept an optional `initialChatId` prop and load that session on mount instead of defaulting to the first list entry.
- [x] 1.4 Handle unknown session IDs: if `GET /api/chats/[id]` returns 404, call `router.replace('/')` from the chat page.

## 2. Session Switch Updates the URL

- [x] 2.1 Update `openChat` in `ChatSessionContext` to call `router.push(\`/chat/${id}\`)` (using `useRouter` from `next/navigation`) in addition to loading the session data.
- [x] 2.2 Update `createChat` in `ChatSessionContext` to call `router.push(\`/chat/${newId}\`)` after creating the session.
- [x] 2.3 Update `deleteChat` so that after selecting the fallback session it navigates to `/chat/${fallbackId}` (or `/chat/${newId}` if a new session is created).

## 3. Session Title in Page Header

- [x] 3.1 Add the active session title to the top bar of the Dashboard (read `activeSession?.title` from `useChatSession()`).

## 4. Abort In-Flight LLM Request

- [x] 4.1 Add `abortControllerRef = useRef<AbortController | null>(null)` to `ChatSessionContext`.
- [x] 4.2 In `sendMessage`, create a new `AbortController`, store it in `abortControllerRef.current`, and pass `signal` to the `fetch` call for `POST /api/chats/[id]/messages`.
- [x] 4.3 Add `abortMessage` function to `ChatSessionContext` that calls `abortControllerRef.current?.abort()` and sets `isTyping` to false.
- [x] 4.4 Expose `isGenerating` (alias for `isTyping`) and `abortMessage` in the context value and `ChatSessionContextValue` interface.
- [x] 4.5 Handle the `AbortError` in `sendMessage`'s catch block: do not throw; simply ensure `isTyping` is set to false (already handled by `finally`).

## 5. Stop Button in Composer

- [x] 5.1 Import `abortMessage` and `isGenerating` from `useChatSession()` in the Dashboard component.
- [x] 5.2 Conditionally render a Stop button (square/stop icon) in place of the Send button when `isGenerating` is true.
- [x] 5.3 Wire the Stop button's `onClick` to `abortMessage`.
- [x] 5.4 Ensure the Stop button is always enabled (not disabled) while `isGenerating` is true.

## 6. Auto-Resizing Composer Textarea

- [x] 6.1 Verify `resizeComposerInput` is called on every `onInput` event and on initial mount (already partially done; confirm it resets height correctly after submit).
- [x] 6.2 Ensure the textarea `onInput` handler resets height to `"auto"` before measuring `scrollHeight` so shrinking content reduces the textarea correctly.
- [x] 6.3 Confirm the textarea resets to single-line height after message submission (clear and trigger resize).

## 7. Vertically Centered Placeholder

- [x] 7.1 Wrap the composer textarea in a flex container styled with `align-items: center` (or adjust the existing `.composer-wrap` styles).
- [x] 7.2 Add a `data-has-content` attribute to the textarea wrapper: set to `"true"` when the textarea has text, `"false"` when empty.
- [x] 7.3 Add CSS rule: when `[data-has-content="true"]`, switch the container to `align-items: flex-start` so multiline text aligns to the top.
- [x] 7.4 Ensure the `data-has-content` attribute is updated in the `onInput` handler and reset to `"false"` after message submission.
