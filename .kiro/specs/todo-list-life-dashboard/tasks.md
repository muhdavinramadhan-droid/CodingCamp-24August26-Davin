# Implementation Plan: Todo List Life Dashboard

## Overview

This plan implements the dashboard as three shipped files — `index.html`, `css/styles.css`, and `js/app.js` — with no frameworks and no backend. The JavaScript is organized into logical closures within the single `js/app.js` file: App/Bootstrap, StorageService, Utilities, GreetingModule, FocusTimerModule, TodoListModule, and QuickLinksModule.

Work proceeds bottom-up: first the page skeleton and shared pure helpers, then the isolated StorageService, then each feature module (each building on the helpers and storage), and finally bootstrap wiring plus styling. Property-based tests are an optional, dev-only verification layer (fast-check, ≥100 iterations per property, tagged `Feature: todo-list-life-dashboard, Property N`) that lives outside the shipped files per NFR-1, so no test task adds tooling or dependencies to `index.html`, `css/styles.css`, or `js/app.js`.

## Tasks

- [x] 1. Create page structure and file scaffolding
  - Create `index.html` with a root layout and four labeled section containers (greeting, focus timer, to-do list, quick links), each in a distinct bounding container with a heading
  - Add a shared error/banner region element for storage and session messages
  - Add the greeting elements (time, date, greeting text), timer display and start/stop/reset controls, todo add form + list container + inline error region, and quick-link add form (label + URL) + list container + inline error region
  - Link `css/styles.css` and `js/app.js` (deferred) from `index.html`; create empty `css/styles.css` and `js/app.js`
  - _Requirements: 9.1, 9.2, 9.3, 9.7, 10.4_

- [x] 2. Implement shared Utilities (pure functions)
  - [x] 2.1 Implement time, date, and greeting helpers in `js/app.js`
    - `formatTime(date)` → 24-hour `HH:MM`; `formatDate(date)` → day, month, four-digit year; `greetingForHour(hour)` → morning/afternoon/evening selection including boundary hours 5, 12, 18
    - Expose Utilities on a namespace guarded to work both in the browser and under a test runner
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.2 Write property test for time formatting
    - **Property 1: Time is formatted as 24-hour HH:MM**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Write property test for date formatting
    - **Property 2: Date shows day, month, and four-digit year**
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Write property test for greeting selection
    - **Property 3: Greeting selection is correct for every hour**
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.7**

  - [x] 2.5 Implement timer and validation helpers in `js/app.js`
    - `formatMMSS(seconds)` → `MM:SS`; `validateTaskText(raw)` → trim + 1–500 char bounds with classified result; `validateLabel(raw)` → 1–50 chars; `validateUrl(raw)` → http/https, 1–2048 chars, parseable
    - _Requirements: 2.1, 3.1, 3.4, 3.5, 4.1, 4.3, 4.4, 8.1, 8.6_

  - [ ]* 2.6 Write property test for MM:SS formatting
    - **Property 4: MM:SS timer formatting round-trips**
    - **Validates: Requirements 2.1, 2.4, 2.5, 2.6**

  - [ ]* 2.7 Write property tests for task text validation
    - **Property 6: Valid task text is accepted, trimmed, and stored**
    - **Property 7: Whitespace-only task text is rejected**
    - **Property 8: Over-length task text is rejected**
    - **Validates: Requirements 3.1, 3.4, 3.5, 4.1, 4.3, 4.4**

  - [ ]* 2.8 Write property test for quick-link validation
    - **Property 15: Invalid quick links are rejected with the offending field identified**
    - **Validates: Requirements 8.6**

- [x] 3. Implement StorageService
  - [x] 3.1 Implement StorageService in `js/app.js`
    - `isAvailable()` probe write/remove inside try/catch; `load(key)` returns `{ok, value?, reason}` with `reason:'parse'` on corrupt JSON and missing key → empty result; `save(key, value)` stringifies + writes, classifying `quota` vs `write` failures; never throws to callers
    - Define storage keys `dashboard.tasks` and `dashboard.quickLinks`
    - _Requirements: 7.4, 7.5, 8.5, 8.8, 9.4, 9.5, 9.6_

  - [ ]* 3.2 Write unit tests for StorageService
    - Missing key → empty state; corrupt JSON → `reason:'parse'`; quota vs generic write classification via stubbed storage; unavailable storage detection
    - _Requirements: 7.4, 7.5, 8.5, 8.8, 9.5, 9.6_

- [x] 4. Implement FocusTimerModule
  - [x] 4.1 Implement FocusTimerModule in `js/app.js`
    - Internal `remainingSeconds` (start 1500) and `intervalId`; `init(rootEl)` renders `25:00`; `render()` paints `MM:SS`; `start()`/`stop()`/`reset()` with 1000 ms tick; handle reaching `00:00`, start-while-running no-op, stop-while-stopped no-op, start-at-zero rejected
    - Wire start/stop/reset controls to the DOM elements
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 4.2 Write property test for redundant timer control actions
    - **Property 5: Redundant timer control actions are no-ops**
    - **Validates: Requirements 2.7, 2.8**

  - [ ]* 4.3 Write unit tests for timer edge cases
    - Initial `25:00`, decrement per tick (faked timers), stop retains, reset to `25:00`, reach `00:00` stops, start-at-zero rejected
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.9_

- [x] 5. Implement GreetingModule
  - [x] 5.1 Implement GreetingModule in `js/app.js`
    - `init(rootEl)` renders immediately then schedules `setInterval` (well under 60 s); `render(now)` paints time/date/greeting via Utilities; boundary-crossing greeting update; time-source-unavailable path shows "time unavailable" and omits greeting
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 5.2 Write unit tests for greeting edge cases
    - Invalid/unavailable time source → "unavailable" + no greeting; boundary-crossing update via faked timers
    - _Requirements: 1.3, 1.7, 1.8_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement TodoListModule
  - [x] 7.1 Implement task state, rendering, and add/edit in `js/app.js`
    - Internal `tasks` array; `init(rootEl)` loads via StorageService (empty on missing, empty + load error on parse failure) and renders; `addTask(rawText)` and `editTask(id, rawText)` validate first, update memory, render, then persist; on persistence failure retain in-memory change and show "not saved" error
    - Render done tasks with a persistent completed visual style hook (class)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.3, 7.4, 7.5_

  - [x] 7.2 Implement toggle and delete in `js/app.js`
    - `toggleTask(id)` flips only the targeted task; `deleteTask(id)` removes only the targeted task; non-existent id → no change (error indication on delete); persist after each mutation with failure handling that retains in-memory state
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 7.3_

  - [ ]* 7.3 Write property tests for task operations
    - **Property 9: Toggling completion flips only the targeted task**
    - **Property 10: Toggling twice restores the original state**
    - **Property 11: Operations on a non-existent id leave the list unchanged**
    - **Property 12: Deleting removes exactly the targeted task**
    - **Validates: Requirements 5.1, 5.2, 5.6, 6.1, 6.3**

  - [ ]* 7.4 Write property test for task serialization round-trip
    - **Property 13: Task list serialization round-trips**
    - **Validates: Requirements 7.2, 9.4**

  - [ ]* 7.5 Write unit tests for task persistence failure paths
    - Quota/write failure via stubbed StorageService → in-memory retained + error; corrupt storage → empty list + load error
    - _Requirements: 3.6, 4.5, 5.5, 6.4, 7.5_

- [x] 8. Implement QuickLinksModule
  - [x] 8.1 Implement quick-link state, rendering, add, open, and delete in `js/app.js`
    - Internal `links` array; `init(rootEl)` loads via StorageService (silent empty fallback on parse failure) and renders; `addLink(label, url)` validates label + URL, enforces the 50-link cap before creation, updates memory, renders, then persists; `openLink(id)` opens URL via `window.open(url, '_blank', 'noopener')`; `deleteLink(id)` removes only the targeted link; persist after each change with failure handling
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 8.2 Write property tests for quick-link operations
    - **Property 14: Valid quick links are accepted and stored**
    - **Property 16: Deleting removes exactly the targeted quick link**
    - **Property 17: The quick-link set never exceeds the cap**
    - **Validates: Requirements 8.1, 8.3, 8.7**

  - [ ]* 8.3 Write property test for quick-link serialization round-trip
    - **Property 18: Quick-link set serialization round-trips**
    - **Validates: Requirements 8.4, 8.5**

- [x] 9. Implement App / Bootstrap and wire modules together
  - [x] 9.1 Implement bootstrap in `js/app.js`
    - On `DOMContentLoaded`: call `StorageService.isAvailable()` and show a persistent "data will not be saved" banner if unavailable while still initializing all modules; perform browser-support check and show an "unsupported browser" message (preserving access to stored data) when unsupported; initialize GreetingModule, FocusTimerModule, TodoListModule, and QuickLinksModule against their section containers
    - _Requirements: 9.6, 10.6, 10.2_

  - [ ]* 9.2 Write unit tests for bootstrap behavior
    - Storage-unavailable banner shown + modules still initialized; unsupported-browser message with preserved stored data
    - _Requirements: 9.6, 10.6_

- [x] 10. Style the dashboard in css/styles.css
  - Style the four sections as distinct bounding containers with clear boundaries and labels; style the completed-task visual indicator so it is persistently distinguishable; style error banner and inline field errors; ensure a usable, readable layout
  - _Requirements: 5.3, 10.3, 10.4, 10.5_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP; per NFR-1 they form a dev-only verification layer (fast-check, ≥100 iterations, tagged `Feature: todo-list-life-dashboard, Property N`) and add no tooling or dependencies to the shipped `index.html`, `css/styles.css`, or `js/app.js`.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation.
- Property tests validate the universal correctness properties; unit tests validate specific examples and edge cases.
- Timing, cross-browser rendering, standalone/PWA operation, and structural constraints (single CSS file, single JS file, no backend) are verified by inspection and manual checks per the design's Testing Strategy rather than as coding tasks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.5"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["9.1"] },
    { "id": 10, "tasks": ["10"] },
    { "id": 11, "tasks": ["2.2", "2.3", "2.4", "2.6", "2.7", "2.8", "3.2", "4.2", "4.3", "5.2", "7.3", "7.4", "7.5", "8.2", "8.3", "9.2"] }
  ]
}
```
