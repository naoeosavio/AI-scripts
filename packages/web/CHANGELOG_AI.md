# Changelog

## v0.2.1 — 2026-09-08

### Features
- Add per-command risk gating for approval mode via `/api/risk-check`
- Introduce Require Approval and No-Exec safety modes for execution control
- Implement session management and terminal layout features
- `--prompt` fills the chat inbox instead of injecting a chat message: `/api/config` exposes `initialPrompt`, which the client puts in the input box (never auto-sent); unsent inbox text persists as `session.draft` through the existing session pipeline, so a reload restores what was typed and a fresh boot prompt wins over it

### Fixes
- Update development script server entry path
- Collapse chain feedback cards by default

### Refactors
- Rework terminal placement hidden option into a dedicated full-width action button
- Consolidate web sandbox tests into a unified root suite
- Improve Toast component structure, theme readability, and terminal layout functions

### Documentation
- Correct package license identifier and add a dedicated License section
- Update web server path references
- Document chat-header execution modes, precedence, and safety controls

### Tests
- Add comprehensive test suite for web backend functionality including routing, security guards, and session persistence
- Enhance existing test cases for authentication, chain feedback, chat threads, and terminal layouts

### Chores
- Update TypeScript configuration and Vite setup for improved module resolution

---

## v0.2 — 2026-09-08

### Features
- Add isolated login screen with in-memory-only token authentication and rate limiting
- Introduce multi-directional terminal docking, controlled tab state, and flexible layout configuration
- Add agent feed panel with auto-expansion on errors and clipboard support
- Implement chat thread management with persistence, duplication, forking, and title generation
- Add chat message editing, resend capabilities, and global toast notifications
- Implement per-command risk gating and execution safety modes (Require Approval, No-Exec)
- Add session snapshot management, history restore, and file conflict detection
- Overhaul file explorer and viewer with tree filtering, icons, and binary detection

### Fixes
- Collapse chain feedback cards by default
- Align classic layout default sidebar to the right
- Guard against undefined model spec parts and prevent UI crashes on missing tabs
- Harden terminal WebSocket connections, reconnection backoff, and idle resource cleanup

### Refactors
- Consolidate sandbox tests into a unified root suite
- Streamline terminal layout helpers and Toast component architecture
- Extract pure chat rendering helpers and session management modules

### Documentation
- Rewrite project README and add comprehensive web-sandbox guide
- Document execution mode toggles, CLI flags, and correct license identifiers

### Tests
- Add comprehensive unit test suite covering PTY, server routes, security guards, and chat/terminal rules

### Chores
- Configure project metadata, build pipeline, and production bundling for the web package
