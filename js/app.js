// Todo List Life Dashboard — behavior
// Organized into logical modules within this single file (Requirement 9.3).
// Remaining modules (StorageService, GreetingModule, FocusTimerModule,
// TodoListModule, QuickLinksModule, App/Bootstrap) are implemented in later tasks.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilities — pure helper functions shared across modules.
  // No DOM or storage access. Deterministic and side-effect free so they are
  // straightforward to verify and reuse (design: Utilities module).
  // ---------------------------------------------------------------------------
  var Utilities = {
    /**
     * Format a Date as 24-hour HH:MM local time.
     * HH is 00-23, MM is 00-59 (Requirement 1.1).
     * @param {Date} date
     * @returns {string} e.g. "09:05", "23:59"
     */
    formatTime: function (date) {
      var hours = date.getHours();
      var minutes = date.getMinutes();
      return pad2(hours) + ':' + pad2(minutes);
    },

    /**
     * Format a Date as a human-readable date including day, month, and
     * four-digit year (Requirement 1.2). e.g. "Monday, 5 January 2026".
     * @param {Date} date
     * @returns {string}
     */
    formatDate: function (date) {
      var weekdays = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday'
      ];
      var months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      var weekday = weekdays[date.getDay()];
      var day = date.getDate();
      var month = months[date.getMonth()];
      var year = date.getFullYear();
      return weekday + ', ' + day + ' ' + month + ' ' + year;
    },

    /**
     * Select the time-of-day greeting for a given local hour (0-23).
     * "Good morning"   when 5 <= h <= 11
     * "Good afternoon" when 12 <= h <= 17
     * "Good evening"   when h >= 18 or h <= 4
     * Boundary hours 5, 12, and 18 are handled explicitly
     * (Requirements 1.4, 1.5, 1.6, 1.7).
     * @param {number} hour integer hour 0-23
     * @returns {string}
     */
    greetingForHour: function (hour) {
      if (hour >= 5 && hour <= 11) {
        return 'Good morning';
      }
      if (hour >= 12 && hour <= 17) {
        return 'Good afternoon';
      }
      // hour >= 18 || hour <= 4
      return 'Good evening';
    },

    /**
     * Format a whole number of seconds as MM:SS.
     * Both fields are zero-padded to two digits; for values that produce
     * three-or-more-digit minutes the minutes field simply widens
     * (e.g. 100:00 for 6000s), but the timer only ever formats 0-1500s so
     * MM stays in 00-99 (design: Property 4, Requirement 2.1).
     * @param {number} seconds whole number of seconds (>= 0)
     * @returns {string} e.g. "25:00", "00:00", "01:05"
     */
    formatMMSS: function (seconds) {
      var total = Math.floor(seconds);
      var minutes = Math.floor(total / 60);
      var secs = total % 60;
      return pad2(minutes) + ':' + pad2(secs);
    },

    /**
     * Validate and normalize to-do task text: trim, then enforce a length of
     * 1-500 characters. Returns a classified result so callers can surface the
     * correct field error (Requirements 3.1, 3.4, 3.5, 4.1, 4.3, 4.4).
     * @param {string} raw raw user input
     * @returns {{ok: boolean, value?: string, reason?: string}}
     *   ok:true with the trimmed value when valid; otherwise ok:false with
     *   reason 'empty' (empty/whitespace only) or 'too_long' (> 500 chars).
     */
    validateTaskText: function (raw) {
      var value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length === 0) {
        return { ok: false, reason: 'empty' };
      }
      if (value.length > 500) {
        return { ok: false, reason: 'too_long' };
      }
      return { ok: true, value: value };
    },

    /**
     * Validate and normalize a quick-link label: trim, then enforce a length
     * of 1-50 characters (Requirements 8.1, 8.6).
     * @param {string} raw raw user input
     * @returns {{ok: boolean, value?: string, reason?: string}}
     *   ok:true with the trimmed value when valid; otherwise ok:false with
     *   reason 'empty' (empty/whitespace only) or 'too_long' (> 50 chars).
     */
    validateLabel: function (raw) {
      var value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length === 0) {
        return { ok: false, reason: 'empty' };
      }
      if (value.length > 50) {
        return { ok: false, reason: 'too_long' };
      }
      return { ok: true, value: value };
    },

    /**
     * Validate and normalize a quick-link URL: trim, enforce a length of
     * 1-2048 characters, require a parseable URL, and restrict the scheme to
     * http or https (Requirements 8.1, 8.6).
     * @param {string} raw raw user input
     * @returns {{ok: boolean, value?: string, reason?: string}}
     *   ok:true with the trimmed value when valid; otherwise ok:false with
     *   reason 'empty', 'too_long' (> 2048 chars), or 'invalid'
     *   (unparseable or non-http/https scheme).
     */
    validateUrl: function (raw) {
      var value = typeof raw === 'string' ? raw.trim() : '';
      if (value.length === 0) {
        return { ok: false, reason: 'empty' };
      }
      if (value.length > 2048) {
        return { ok: false, reason: 'too_long' };
      }
      var parsed;
      try {
        parsed = new URL(value);
      } catch (e) {
        return { ok: false, reason: 'invalid' };
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, reason: 'invalid' };
      }
      return { ok: true, value: value };
    }
  };

  /**
   * Zero-pad a non-negative integer to at least two digits.
   * @param {number} n
   * @returns {string}
   */
  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // ---------------------------------------------------------------------------
  // StorageService — the only code that touches window.localStorage.
  // Concentrates all persistence access and error classification in one place
  // (design: StorageService). Every method returns a structured result and
  // never throws to callers, so the rest of the app treats persistence as a
  // simple load/save that reports success or a classified failure reason.
  //
  // Result shapes:
  //   load success: { ok: true, value }
  //   load missing: { ok: true, value: undefined }  (missing key → empty result)
  //   failure:      { ok: false, reason: 'unavailable' | 'parse' | 'quota' | 'write' }
  //   save success: { ok: true }
  //   save failure: { ok: false, reason: 'unavailable' | 'quota' | 'write' }
  // ---------------------------------------------------------------------------

  // Storage keys (Requirement 9.4). Full collections are rewritten under these
  // keys on every mutation.
  var STORAGE_KEYS = {
    TASKS: 'dashboard.tasks',
    QUICK_LINKS: 'dashboard.quickLinks',
    THEME: 'dashboard.theme'
  };

  /**
   * Resolve the Local Storage object, if the environment exposes one.
   * Accessing window.localStorage can itself throw in some hardened browsers,
   * so the access is guarded.
   * @returns {Storage|null}
   */
  function getLocalStorage() {
    try {
      if (typeof global.localStorage !== 'undefined' && global.localStorage) {
        return global.localStorage;
      }
    } catch (e) {
      // Some browsers throw on property access when storage is disabled.
      return null;
    }
    return null;
  }

  /**
   * Determine whether a thrown error represents a Local Storage quota overflow.
   * Detected by name === 'QuotaExceededError' or the legacy numeric codes 22
   * (most browsers) / 1014 (Firefox) (design: QuotaExceededError detection).
   * @param {*} err
   * @returns {boolean}
   */
  function isQuotaError(err) {
    if (!err) {
      return false;
    }
    if (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return true;
    }
    return err.code === 22 || err.code === 1014;
  }

  var StorageService = {
    /**
     * Feature-detect Local Storage by writing and removing a probe key inside
     * a try/catch. Detects storage that is missing, disabled, or throwing
     * (Requirement 9.6). Never throws.
     * @returns {boolean} true when a value can be written and removed.
     */
    isAvailable: function () {
      var storage = getLocalStorage();
      if (!storage) {
        return false;
      }
      var probe = '__dashboard_probe__';
      try {
        storage.setItem(probe, probe);
        storage.removeItem(probe);
        return true;
      } catch (e) {
        return false;
      }
    },

    /**
     * Read and JSON-parse the value stored under a key. A missing key yields an
     * empty result (Requirements 7.4, 8.5); corrupt/unparseable data yields
     * reason 'parse' so callers can fall back to empty state (Requirements 7.5,
     * 8.8). Never throws.
     * @param {string} key
     * @returns {{ok: boolean, value?: *, reason?: string}}
     *   { ok:true, value }            on success,
     *   { ok:true, value:undefined }  when the key is absent,
     *   { ok:false, reason:'unavailable' } when storage cannot be accessed,
     *   { ok:false, reason:'parse' }  when the stored JSON cannot be parsed.
     */
    load: function (key) {
      var storage = getLocalStorage();
      if (!storage) {
        return { ok: false, reason: 'unavailable' };
      }
      var raw;
      try {
        raw = storage.getItem(key);
      } catch (e) {
        return { ok: false, reason: 'unavailable' };
      }
      if (raw === null || typeof raw === 'undefined') {
        // Missing key → empty result.
        return { ok: true, value: undefined };
      }
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch (e) {
        return { ok: false, reason: 'parse' };
      }
    },

    /**
     * JSON-stringify a value and write it under a key. Classifies failures as
     * 'quota' (storage full) versus 'write' (any other write error), and
     * 'unavailable' when storage cannot be accessed (Requirements 9.5, 3.6,
     * 4.5, 5.5, 6.4). Never throws.
     * @param {string} key
     * @param {*} value serializable value
     * @returns {{ok: boolean, reason?: string}}
     *   { ok:true } on success; otherwise { ok:false, reason } with reason
     *   'unavailable' | 'quota' | 'write'.
     */
    save: function (key, value) {
      var storage = getLocalStorage();
      if (!storage) {
        return { ok: false, reason: 'unavailable' };
      }
      var serialized;
      try {
        serialized = JSON.stringify(value);
      } catch (e) {
        // A value that cannot be serialized is treated as a write failure.
        return { ok: false, reason: 'write' };
      }
      try {
        storage.setItem(key, serialized);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: isQuotaError(e) ? 'quota' : 'write' };
      }
    }
  };

  // ---------------------------------------------------------------------------
  // FocusTimerModule — owns the 25-minute countdown and its start/stop/reset
  // controls (design: FocusTimerModule). Internal state is the source of truth:
  //   remainingSeconds — integer seconds left, starts at 1500 (25:00)
  //   intervalId       — the active setInterval handle, or null when stopped
  // The timer holds no persisted data; it always resets to 25:00 on load
  // (Requirement 2.1). Ticks once per second via setInterval (Requirements 2.2,
  // 2.3). All edge cases (reaching 00:00, start-while-running, stop-while-
  // stopped, start-at-zero) are handled here.
  // ---------------------------------------------------------------------------
  var TIMER_DURATION_SECONDS = 1500; // 25:00 (Timer_Duration, Requirement 2.1)
  var TIMER_TICK_MS = 1000;          // 1 s tick (Requirements 2.2, 2.3)
  var TIMER_MIN_MINUTES = 1;         // custom-duration lower bound (challenge)
  var TIMER_MAX_MINUTES = 120;       // custom-duration upper bound (challenge)

  var TIMER_MESSAGES = {
    INVALID: 'Enter a whole number of minutes between ' + TIMER_MIN_MINUTES +
      ' and ' + TIMER_MAX_MINUTES + '.'
  };

  var FocusTimerModule = {
    // Internal state.
    // durationSeconds is the currently configured focus length (defaults to
    // 25:00); remainingSeconds is what the countdown shows.
    durationSeconds: TIMER_DURATION_SECONDS,
    remainingSeconds: TIMER_DURATION_SECONDS,
    intervalId: null,

    // Cached DOM references, resolved in init().
    _displayEl: null,
    _startEl: null,
    _stopEl: null,
    _resetEl: null,
    _durationFormEl: null,
    _durationInputEl: null,
    _errorEl: null,

    /**
     * Resolve the timer's DOM elements, wire the start/stop/reset controls, and
     * render the initial 25:00 display (Requirement 2.1). Safe to call once on
     * bootstrap. Missing controls are tolerated so the module still renders.
     * @param {Element|Document} [rootEl] optional scope; defaults to document.
     * @returns {void}
     */
    init: function (rootEl) {
      var scope = rootEl && typeof rootEl.querySelector === 'function'
        ? rootEl
        : (typeof global.document !== 'undefined' ? global.document : null);

      if (scope) {
        this._displayEl =
          scope.querySelector('#timer-display') ||
          (typeof scope.getElementById === 'function'
            ? scope.getElementById('timer-display')
            : null);
        this._startEl = scope.querySelector
          ? scope.querySelector('#timer-start')
          : null;
        this._stopEl = scope.querySelector
          ? scope.querySelector('#timer-stop')
          : null;
        this._resetEl = scope.querySelector
          ? scope.querySelector('#timer-reset')
          : null;
        this._durationFormEl = scope.querySelector
          ? scope.querySelector('#timer-duration-form')
          : null;
        this._durationInputEl = scope.querySelector
          ? scope.querySelector('#timer-duration-input')
          : null;
        this._errorEl = scope.querySelector
          ? scope.querySelector('#timer-error')
          : null;
      }

      var self = this;
      if (this._startEl) {
        this._startEl.addEventListener('click', function () {
          self.start();
        });
      }
      if (this._stopEl) {
        this._stopEl.addEventListener('click', function () {
          self.stop();
        });
      }
      if (this._resetEl) {
        this._resetEl.addEventListener('click', function () {
          self.reset();
        });
      }

      // Wire the custom-duration form so submitting sets a new focus length
      // (challenge: change Pomodoro time).
      if (this._durationFormEl &&
          typeof this._durationFormEl.addEventListener === 'function') {
        this._durationFormEl.addEventListener('submit', function (event) {
          if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          var raw = self._durationInputEl ? self._durationInputEl.value : '';
          self.setDuration(raw);
        });
      }

      // Reset to the configured duration on load (defaults to 25:00) and paint.
      this.remainingSeconds = this.durationSeconds;
      this.render();
    },

    /**
     * Set a new focus duration from raw minutes input. Accepts a whole number
     * of minutes between TIMER_MIN_MINUTES and TIMER_MAX_MINUTES; anything else
     * is rejected with an inline error and leaves the current duration
     * untouched. On success the countdown is stopped and reset to the new
     * length so the change takes effect immediately (challenge: change
     * Pomodoro time).
     * @param {string|number} rawMinutes raw minutes input.
     * @returns {{ok: boolean, reason?: string}}
     */
    setDuration: function (rawMinutes) {
      var minutes = typeof rawMinutes === 'string'
        ? Number(rawMinutes.trim())
        : Number(rawMinutes);

      var valid = isFinite(minutes) &&
        Math.floor(minutes) === minutes &&
        minutes >= TIMER_MIN_MINUTES &&
        minutes <= TIMER_MAX_MINUTES;

      if (!valid) {
        this._showError(TIMER_MESSAGES.INVALID);
        return { ok: false, reason: 'invalid' };
      }

      this._clearError();
      this.durationSeconds = minutes * 60;

      // Apply the new length immediately: stop any running countdown and reset
      // the display to the full new duration.
      this.stop();
      this.remainingSeconds = this.durationSeconds;
      this.render();
      return { ok: true };
    },

    /**
     * Show a message in the timer inline error region. Internal.
     * @param {string} message
     * @returns {void}
     */
    _showError: function (message) {
      if (this._errorEl) {
        this._errorEl.textContent = message;
        this._errorEl.hidden = false;
      }
    },

    /**
     * Clear and hide the timer inline error region. Internal.
     * @returns {void}
     */
    _clearError: function () {
      if (this._errorEl) {
        this._errorEl.textContent = '';
        this._errorEl.hidden = true;
      }
    },

    /**
     * Paint the current remaining time as MM:SS into the display element
     * (Requirement 2.1). Uses the shared Utilities.formatMMSS helper. No-op when
     * no display element is present.
     * @returns {void}
     */
    render: function () {
      if (this._displayEl) {
        this._displayEl.textContent = Utilities.formatMMSS(this.remainingSeconds);
      }
    },

    /**
     * Begin or continue counting down once per second (Requirements 2.2, 2.3).
     * No-op if already running so the countdown is not disturbed (Requirement
     * 2.7). No-op if remainingSeconds is already 0 so a finished timer does not
     * restart (Requirement 2.9).
     * @returns {void}
     */
    start: function () {
      // Already running → leave the existing countdown untouched (Req 2.7).
      if (this.intervalId !== null) {
        return;
      }
      // At 00:00 → do not start (Req 2.9).
      if (this.remainingSeconds <= 0) {
        return;
      }
      var self = this;
      this.intervalId = global.setInterval(function () {
        self._tick();
      }, TIMER_TICK_MS);
    },

    /**
     * Pause the countdown, clearing the interval while retaining the current
     * remaining time (Requirement 2.4). No-op if the timer is not running
     * (Requirement 2.8).
     * @returns {void}
     */
    stop: function () {
      if (this.intervalId === null) {
        return; // Not running → nothing to stop (Req 2.8).
      }
      global.clearInterval(this.intervalId);
      this.intervalId = null;
    },

    /**
     * Stop the countdown and reset the remaining time to the full 25:00
     * duration, repainting the display (Requirement 2.5).
     * @returns {void}
     */
    reset: function () {
      this.stop();
      this.remainingSeconds = this.durationSeconds;
      this.render();
    },

    /**
     * One countdown step: decrement the remaining time, repaint, and stop the
     * countdown once it reaches 00:00 (Requirement 2.6). Internal.
     * @returns {void}
     */
    _tick: function () {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds -= 1;
      }
      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = 0;
        this.stop(); // Reached 00:00 → stop the countdown (Req 2.6).
      }
      this.render();
    }
  };

  // ---------------------------------------------------------------------------
  // GreetingModule — renders the current time (24-hour HH:MM), the full date,
  // and a time-of-day greeting, then refreshes on a periodic interval
  // (design: GreetingModule). The system clock is the source of truth; nothing
  // is persisted.
  //
  // Behavior:
  //   - Renders HH:MM and a full date via the shared Utilities helpers
  //     (Requirements 1.1, 1.2).
  //   - Schedules a setInterval well under 60 s so the displayed time stays
  //     within 60 s of actual and the greeting updates across the boundary
  //     crossings 05:00/12:00/18:00 (Requirements 1.3, 1.7).
  //   - Greeting text derives from Utilities.greetingForHour (Reqs 1.4-1.6).
  //   - If the time source is unavailable (an invalid/unreadable Date), shows a
  //     "time unavailable" indication and omits the greeting (Requirement 1.8).
  // ---------------------------------------------------------------------------
  var GREETING_TICK_MS = 15000;                  // refresh well under 60 s (Reqs 1.3, 1.7)
  var GREETING_TIME_UNAVAILABLE = 'Time unavailable'; // shown when the clock fails (Req 1.8)

  var GreetingModule = {
    // The active setInterval handle, or null when not scheduled.
    intervalId: null,

    // Cached DOM references, resolved in init().
    _timeEl: null,
    _dateEl: null,
    _greetingEl: null,

    /**
     * Resolve the greeting section's DOM elements, render immediately from the
     * current clock, then schedule periodic refreshes (Requirements 1.1, 1.2,
     * 1.3). Rendering immediately means the dashboard shows the time/date/
     * greeting as soon as it loads rather than after the first interval tick.
     * @param {Element|Document} [rootEl] optional scope; defaults to document.
     * @returns {void}
     */
    init: function (rootEl) {
      var scope = rootEl && typeof rootEl.querySelector === 'function'
        ? rootEl
        : (typeof global.document !== 'undefined' ? global.document : null);

      if (scope && typeof scope.querySelector === 'function') {
        this._timeEl = scope.querySelector('#greeting-time');
        this._dateEl = scope.querySelector('#greeting-date');
        this._greetingEl = scope.querySelector('#greeting-text');
      }

      // Render immediately so the greeting is populated on load (Reqs 1.1, 1.2).
      this.render(this._now());

      // Then refresh periodically so the displayed time stays within 60 s of
      // actual and the greeting updates across boundary crossings (Reqs 1.3,
      // 1.7). Guard against double-scheduling if init is called more than once.
      if (this.intervalId === null && typeof global.setInterval === 'function') {
        var self = this;
        this.intervalId = global.setInterval(function () {
          self.render(self._now());
        }, GREETING_TICK_MS);
      }
    },

    /**
     * Paint the time, date, and greeting for a given Date. When the supplied
     * value is not a usable Date (the time source is unavailable), shows a
     * "time unavailable" indication and omits the greeting (Requirement 1.8).
     * @param {Date} now the Date to render.
     * @returns {void}
     */
    render: function (now) {
      if (!isValidDate(now)) {
        // Time source unavailable → indicate it and omit the greeting (Req 1.8).
        if (this._timeEl) {
          this._timeEl.textContent = GREETING_TIME_UNAVAILABLE;
        }
        if (this._dateEl) {
          this._dateEl.textContent = '';
        }
        if (this._greetingEl) {
          this._greetingEl.textContent = '';
        }
        return;
      }

      if (this._timeEl) {
        this._timeEl.textContent = Utilities.formatTime(now);       // HH:MM (Req 1.1)
      }
      if (this._dateEl) {
        this._dateEl.textContent = Utilities.formatDate(now);       // full date (Req 1.2)
      }
      if (this._greetingEl) {
        this._greetingEl.textContent =
          Utilities.greetingForHour(now.getHours());                // greeting (Reqs 1.4-1.7)
      }
    },

    /**
     * Stop periodic refreshes by clearing the interval (design: destroy for
     * completeness). Safe to call when not scheduled.
     * @returns {void}
     */
    destroy: function () {
      if (this.intervalId !== null) {
        if (typeof global.clearInterval === 'function') {
          global.clearInterval(this.intervalId);
        }
        this.intervalId = null;
      }
    },

    /**
     * Read the current time as a Date. Constructing/reading the clock is
     * guarded so a throwing or unavailable time source yields null, which
     * render() treats as the "time unavailable" path (Requirement 1.8).
     * @returns {Date|null}
     */
    _now: function () {
      try {
        return new Date();
      } catch (e) {
        return null;
      }
    }
  };

  /**
   * Determine whether a value is a usable Date (a real Date instance holding a
   * finite time). Guards the greeting's time-source-unavailable path (Req 1.8).
   * @param {*} value
   * @returns {boolean}
   */
  function isValidDate(value) {
    return value instanceof Date && !isNaN(value.getTime());
  }

  // ---------------------------------------------------------------------------
  // TodoListModule — owns the in-memory to-do list and renders it (design:
  // TodoListModule). The in-memory `tasks` array is the source of truth; Local
  // Storage is a mirror kept in sync via StorageService.
  //
  // This part covers task state, rendering, and add/edit (task 7.1):
  //   - init(rootEl): load the stored task list (empty on a missing key; empty
  //     plus a load-error indication on a parse failure) then render
  //     (Requirements 7.1, 7.4, 7.5).
  //   - addTask(rawText): validate first; on success create a not-done task,
  //     update memory, render, then persist (Requirements 3.1, 3.2, 3.3). On
  //     invalid input reject without mutating and surface a field error
  //     (Requirements 3.4, 3.5). On persistence failure keep the in-memory
  //     change and show a "not saved" error (Requirement 3.6).
  //   - editTask(id, rawText): validate first; on success update the task's
  //     trimmed text, render, then persist (Requirements 4.1, 4.2). On invalid
  //     input reject and retain the previous text (Requirements 4.3, 4.4). On
  //     persistence failure keep the in-memory change and show a "not saved"
  //     error (Requirement 4.5).
  //   - render(): paint the list, giving done tasks a persistent completed
  //     visual style hook (a CSS class) so they stay distinguishable without
  //     interaction (Requirement 5.3 style hook), and rendering a completion
  //     checkbox and delete control per item.
  //
  // This part also covers toggle and delete (task 7.2):
  //   - toggleTask(id): flip only the targeted task's done state, render, then
  //     persist; non-existent id makes no change; a persistence failure retains
  //     the in-memory toggle and warns (Requirements 5.1, 5.2, 5.4, 5.5, 5.6).
  //   - deleteTask(id): remove only the targeted task, render, then persist;
  //     a non-existent id leaves the list unchanged and indicates an error; a
  //     persistence failure retains the in-memory removal and warns
  //     (Requirements 6.1, 6.2, 6.3, 6.4).
  //   - Toggle/delete controls are wired via a single delegated click listener
  //     on the list element (Requirement 7.3 persistence on each mutation).
  // ---------------------------------------------------------------------------
  var TASK_TEXT_MAX = 500; // task text upper bound (Requirements 3.5, 4.4)

  // User-facing messages. Kept specific about what happened and whether data
  // was saved (design: Error Handling — user-facing messages).
  var TODO_MESSAGES = {
    EMPTY: 'Task text is required.',
    TOO_LONG: 'Maximum length is ' + TASK_TEXT_MAX + ' characters.',
    DUPLICATE: 'That task is already on your list.',
    LOAD_FAILED: 'Saved tasks could not be loaded.',
    NOT_SAVED: 'The task could not be saved.',
    NOT_FOUND: 'That task no longer exists.'
  };

  var TodoListModule = {
    // Internal state — the in-memory task list (source of truth).
    tasks: [],

    // Cached DOM references, resolved in init().
    _listEl: null,
    _formEl: null,
    _inputEl: null,
    _errorEl: null,

    // Monotonic counter used as a fallback for generating unique ids.
    _idCounter: 0,

    /**
     * Resolve the to-do section's DOM elements, load any stored task list, and
     * render it (Requirements 7.1, 7.4, 7.5). A missing key yields an empty
     * list; a parse failure yields an empty list plus a load-error indication.
     * Also wires the add form's submit handler.
     * @param {Element|Document} [rootEl] optional scope; defaults to document.
     * @returns {void}
     */
    init: function (rootEl) {
      var scope = rootEl && typeof rootEl.querySelector === 'function'
        ? rootEl
        : (typeof global.document !== 'undefined' ? global.document : null);

      if (scope && typeof scope.querySelector === 'function') {
        this._listEl = scope.querySelector('#todo-list');
        this._formEl = scope.querySelector('#todo-form');
        this._inputEl = scope.querySelector('#todo-input');
        this._errorEl = scope.querySelector('#todo-error');
      }

      // Load the stored task list. Missing key → empty list (Req 7.4); parse
      // failure → empty list + load-error indication (Req 7.5).
      var result = StorageService.load(STORAGE_KEYS.TASKS);
      if (result.ok) {
        this.tasks = normalizeTasks(result.value);
      } else {
        this.tasks = [];
        if (result.reason === 'parse') {
          this._showError(TODO_MESSAGES.LOAD_FAILED);
        }
        // 'unavailable' is surfaced by the bootstrap banner, not here.
      }

      var self = this;

      // Wire the add form so submitting adds a task (Requirements 3.1, 3.2).
      if (this._formEl && typeof this._formEl.addEventListener === 'function') {
        this._formEl.addEventListener('submit', function (event) {
          if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          var raw = self._inputEl ? self._inputEl.value : '';
          var addResult = self.addTask(raw);
          if (addResult.ok && self._inputEl) {
            self._inputEl.value = '';
          }
        });
      }

      // Delegate toggle/delete handling to the list so every current and
      // future item is covered without re-binding after each render. The list
      // element itself persists across renders (Requirements 5.1, 5.2, 6.1).
      if (this._listEl && typeof this._listEl.addEventListener === 'function') {
        this._listEl.addEventListener('click', function (event) {
          self._handleListClick(event);
        });
      }

      this.render();
    },

    /**
     * Delegated click handler for the task list. Resolves the clicked control's
     * action ('toggle' or 'delete') and its owning task id, then dispatches to
     * toggleTask/deleteTask. Clicks outside a control are ignored. Internal.
     * @param {Event} event
     * @returns {void}
     */
    _handleListClick: function (event) {
      var target = event ? event.target : null;
      if (!target || typeof target.getAttribute !== 'function') {
        return;
      }
      var action = target.getAttribute('data-action');
      if (action !== 'toggle' && action !== 'delete') {
        return;
      }
      var item = target.closest ? target.closest('.todo__item') : null;
      var id = item ? item.getAttribute('data-id') : null;
      if (!id) {
        return;
      }
      if (action === 'toggle') {
        this.toggleTask(id);
      } else {
        this.deleteTask(id);
      }
    },

    /**
     * Add a new task from raw user input. Validates first; on success creates a
     * not-done task with the trimmed text, appends it to the in-memory list,
     * renders, then persists (Requirements 3.1, 3.2, 3.3). Invalid input is
     * rejected without mutating the list and surfaces a specific field error
     * (Requirements 3.4, 3.5). A persistence failure keeps the in-memory change
     * and shows a "not saved" error (Requirement 3.6).
     * @param {string} rawText raw user input.
     * @returns {{ok: boolean, id?: string, reason?: string}}
     *   ok:true with the new task id on success; otherwise ok:false with reason
     *   'empty' | 'too_long' | 'not_saved'.
     */
    addTask: function (rawText) {
      var validation = Utilities.validateTaskText(rawText);
      if (!validation.ok) {
        // Reject without mutating; surface the specific field error (Reqs 3.4, 3.5).
        this._showError(messageForReason(validation.reason));
        return { ok: false, reason: validation.reason };
      }

      // Reject a task whose text already exists (case-insensitive), without
      // mutating the list (challenge: prevent duplicate tasks).
      if (this._hasDuplicate(validation.value)) {
        this._showError(TODO_MESSAGES.DUPLICATE);
        return { ok: false, reason: 'duplicate' };
      }

      this._clearError();

      // In-memory update first so the UI reflects the change immediately (Req 3.2).
      var task = { id: this._nextId(), text: validation.value, done: false };
      this.tasks.push(task);
      this.render();

      // Persist; on failure keep the in-memory change and warn (Reqs 3.3, 3.6).
      var saved = this._persist();
      if (!saved.ok) {
        this._showError(TODO_MESSAGES.NOT_SAVED);
        return { ok: false, id: task.id, reason: 'not_saved' };
      }
      return { ok: true, id: task.id };
    },

    /**
     * Save an edit to an existing task's text. Validates first; on success
     * updates the task with the trimmed text, renders, then persists
     * (Requirements 4.1, 4.2). Invalid input is rejected and the previous text
     * is retained (Requirements 4.3, 4.4). A persistence failure keeps the
     * in-memory change and shows a "not saved" error (Requirement 4.5). Editing
     * a non-existent id makes no change.
     * @param {string} id the target task id.
     * @param {string} rawText raw user input.
     * @returns {{ok: boolean, reason?: string}}
     *   ok:true on success; otherwise ok:false with reason 'not_found',
     *   'empty' | 'too_long' | 'not_saved'.
     */
    editTask: function (id, rawText) {
      var task = this._findTask(id);
      if (!task) {
        // No matching task → make no change.
        return { ok: false, reason: 'not_found' };
      }

      var validation = Utilities.validateTaskText(rawText);
      if (!validation.ok) {
        // Reject the edit; the previous text is retained (Reqs 4.3, 4.4).
        this._showError(messageForReason(validation.reason));
        return { ok: false, reason: validation.reason };
      }

      // Reject an edit that would duplicate another task's text, ignoring the
      // task being edited (challenge: prevent duplicate tasks).
      if (this._hasDuplicate(validation.value, id)) {
        this._showError(TODO_MESSAGES.DUPLICATE);
        return { ok: false, reason: 'duplicate' };
      }

      this._clearError();

      // In-memory update first (Req 4.1), then render.
      task.text = validation.value;
      this.render();

      // Persist; on failure keep the in-memory change and warn (Reqs 4.2, 4.5).
      var saved = this._persist();
      if (!saved.ok) {
        this._showError(TODO_MESSAGES.NOT_SAVED);
        return { ok: false, reason: 'not_saved' };
      }
      return { ok: true };
    },

    /**
     * Flip the completion state of exactly the targeted task. Only that task's
     * `done` flag is inverted; every other task is left unchanged
     * (Requirements 5.1, 5.2). The in-memory change happens first and the list
     * re-renders so the completed style updates without interaction, then the
     * list is persisted (Requirement 5.4). Toggling a non-existent id makes no
     * change to any task and leaves the persisted list untouched
     * (Requirement 5.6). On a persistence failure the in-memory toggle is
     * retained and a "not saved" error is shown (Requirement 5.5).
     * @param {string} id the target task id.
     * @returns {{ok: boolean, done?: boolean, reason?: string}}
     *   ok:true with the new done state on success; otherwise ok:false with
     *   reason 'not_found' | 'not_saved'.
     */
    toggleTask: function (id) {
      var task = this._findTask(id);
      if (!task) {
        // Non-existent id → no change to any task, storage untouched (Req 5.6).
        return { ok: false, reason: 'not_found' };
      }

      this._clearError();

      // In-memory update first so the completed style reflects immediately,
      // then render (Requirements 5.1, 5.2, 5.3).
      task.done = !task.done;
      this.render();

      // Persist; on failure keep the in-memory toggle and warn (Reqs 5.4, 5.5).
      var saved = this._persist();
      if (!saved.ok) {
        this._showError(TODO_MESSAGES.NOT_SAVED);
        return { ok: false, done: task.done, reason: 'not_saved' };
      }
      return { ok: true, done: task.done };
    },

    /**
     * Remove exactly the targeted task, leaving all other tasks — and their
     * order — unchanged (Requirement 6.1). The in-memory removal happens first
     * and the list re-renders, then the updated list is persisted
     * (Requirement 6.2). Deleting a non-existent id leaves the list unchanged
     * and surfaces an error indication (Requirement 6.3). On a persistence
     * failure the in-memory removal is retained and a "not saved" error is
     * shown (Requirement 6.4).
     * @param {string} id the target task id.
     * @returns {{ok: boolean, reason?: string}}
     *   ok:true on success; otherwise ok:false with reason
     *   'not_found' | 'not_saved'.
     */
    deleteTask: function (id) {
      var index = this._indexOfTask(id);
      if (index === -1) {
        // Non-existent id → leave the list unchanged and indicate an error
        // (Req 6.3).
        this._showError(TODO_MESSAGES.NOT_FOUND);
        return { ok: false, reason: 'not_found' };
      }

      this._clearError();

      // In-memory removal of exactly the targeted task, preserving the order
      // and content of the remaining tasks (Req 6.1), then render.
      this.tasks.splice(index, 1);
      this.render();

      // Persist; on failure keep the in-memory removal and warn (Reqs 6.2, 6.4).
      var saved = this._persist();
      if (!saved.ok) {
        this._showError(TODO_MESSAGES.NOT_SAVED);
        return { ok: false, reason: 'not_saved' };
      }
      return { ok: true };
    },

    /**
     * Render the task list into the list element. Each item carries a stable
     * data-id and, when done, a persistent `todo__item--done` class so the
     * completed style remains visible without interaction (Requirement 5.3
     * style hook). No-op when no list element is present.
     * @returns {void}
     */
    render: function () {
      if (!this._listEl) {
        return;
      }
      // Clear the current contents.
      this._listEl.textContent = '';

      var doc = this._listEl.ownerDocument ||
        (typeof global.document !== 'undefined' ? global.document : null);
      if (!doc) {
        return;
      }

      for (var i = 0; i < this.tasks.length; i += 1) {
        var task = this.tasks[i];

        var item = doc.createElement('li');
        item.className = 'todo__item' + (task.done ? ' todo__item--done' : '');
        item.setAttribute('data-id', task.id);

        // Completion checkbox — toggles the task's done state (Reqs 5.1, 5.2).
        var toggle = doc.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'todo__item-toggle';
        toggle.checked = task.done;
        toggle.setAttribute('data-action', 'toggle');
        toggle.setAttribute(
          'aria-label',
          (task.done ? 'Mark not done: ' : 'Mark done: ') + task.text
        );

        var text = doc.createElement('span');
        text.className = 'todo__item-text';
        text.textContent = task.text;

        // Delete control — removes only this task (Req 6.1).
        var remove = doc.createElement('button');
        remove.type = 'button';
        remove.className = 'todo__item-delete';
        remove.setAttribute('data-action', 'delete');
        remove.setAttribute('aria-label', 'Delete: ' + task.text);
        remove.textContent = 'Delete';

        item.appendChild(toggle);
        item.appendChild(text);
        item.appendChild(remove);
        this._listEl.appendChild(item);
      }
    },

    /**
     * Persist the current in-memory task list via StorageService (Requirements
     * 3.3, 4.2, 7.3). Internal.
     * @returns {{ok: boolean, reason?: string}}
     */
    _persist: function () {
      return StorageService.save(STORAGE_KEYS.TASKS, this.tasks);
    },

    /**
     * Determine whether a task with the given text already exists, comparing
     * case-insensitively on trimmed text. An optional excludeId skips a single
     * task (used when editing so a task does not clash with itself). Internal.
     * @param {string} text the already-trimmed candidate text.
     * @param {string} [excludeId] a task id to ignore during the comparison.
     * @returns {boolean}
     */
    _hasDuplicate: function (text, excludeId) {
      var normalized = text.toLowerCase();
      for (var i = 0; i < this.tasks.length; i += 1) {
        var existing = this.tasks[i];
        if (excludeId && existing.id === excludeId) {
          continue;
        }
        if (existing.text.trim().toLowerCase() === normalized) {
          return true;
        }
      }
      return false;
    },

    /**
     * Find a task by id, or null when absent. Internal.
     * @param {string} id
     * @returns {?object}
     */
    _findTask: function (id) {
      for (var i = 0; i < this.tasks.length; i += 1) {
        if (this.tasks[i].id === id) {
          return this.tasks[i];
        }
      }
      return null;
    },

    /**
     * Find the index of a task by id, or -1 when absent. Internal.
     * @param {string} id
     * @returns {number}
     */
    _indexOfTask: function (id) {
      for (var i = 0; i < this.tasks.length; i += 1) {
        if (this.tasks[i].id === id) {
          return i;
        }
      }
      return -1;
    },

    /**
     * Generate a stable unique id for a new task, preferring crypto.randomUUID
     * and falling back to a timestamp + monotonic counter. Internal.
     * @returns {string}
     */
    _nextId: function () {
      try {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
          return global.crypto.randomUUID();
        }
      } catch (e) {
        // Fall through to the timestamp-based id.
      }
      this._idCounter += 1;
      return 't-' + Date.now() + '-' + this._idCounter;
    },

    /**
     * Show a message in the to-do inline error region. Internal.
     * @param {string} message
     * @returns {void}
     */
    _showError: function (message) {
      if (this._errorEl) {
        this._errorEl.textContent = message;
        this._errorEl.hidden = false;
      }
    },

    /**
     * Clear and hide the to-do inline error region. Internal.
     * @returns {void}
     */
    _clearError: function () {
      if (this._errorEl) {
        this._errorEl.textContent = '';
        this._errorEl.hidden = true;
      }
    }
  };

  /**
   * Map a validation failure reason to a user-facing to-do message.
   * @param {string} reason 'empty' | 'too_long'
   * @returns {string}
   */
  function messageForReason(reason) {
    return reason === 'too_long' ? TODO_MESSAGES.TOO_LONG : TODO_MESSAGES.EMPTY;
  }

  /**
   * Normalize a loaded value into a well-formed task array. Tolerates a missing
   * or malformed stored value by dropping entries that are not shaped like a
   * Task, coercing text to a string and done to a boolean. Restored text and
   * completion state match the saved values (Requirement 7.2).
   * @param {*} value the value returned by StorageService.load
   * @returns {Array<{id: string, text: string, done: boolean}>}
   */
  function normalizeTasks(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    var tasks = [];
    for (var i = 0; i < value.length; i += 1) {
      var entry = value[i];
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      if (typeof entry.text !== 'string') {
        continue;
      }
      tasks.push({
        id: typeof entry.id === 'string' && entry.id.length > 0
          ? entry.id
          : 't-' + Date.now() + '-' + i,
        text: entry.text,
        done: entry.done === true
      });
    }
    return tasks;
  }

  // ---------------------------------------------------------------------------
  // QuickLinksModule — owns the in-memory quick-link set and renders it
  // (design: QuickLinksModule). The in-memory `links` array is the source of
  // truth; Local Storage is a mirror kept in sync via StorageService.
  //
  //   - init(rootEl): load the stored quick-link set and render. A missing key
  //     yields an empty set; a read/parse failure also falls back to an empty
  //     set silently, without raising an unhandled error (Requirements 8.5,
  //     8.8).
  //   - addLink(label, url): validate label + URL first, enforce the 50-link
  //     cap before creation, then update memory, render, and persist. Invalid
  //     input is rejected identifying the offending field and leaves the set
  //     unchanged (Requirements 8.1, 8.6, 8.7). A persistence failure keeps the
  //     in-memory change and warns (Requirement 8.4).
  //   - openLink(id): open the target URL in a new tab via
  //     window.open(url, '_blank', 'noopener') (Requirement 8.2).
  //   - deleteLink(id): remove only the targeted link, render, then persist; a
  //     non-existent id leaves the set unchanged; a persistence failure retains
  //     the in-memory removal and warns (Requirements 8.3, 8.4).
  //   - render(): paint the set, giving each link an open control and a delete
  //     control. Open/delete are wired via a single delegated click listener on
  //     the list element (Requirement 8.4 persistence on each change).
  // ---------------------------------------------------------------------------
  var MAX_QUICK_LINKS = 50; // upper bound on the quick-link set (Requirement 8.7)

  // User-facing messages. The add-error messages name the offending field so
  // the user can correct it (design: Error Handling — Quick link add).
  var LINKS_MESSAGES = {
    LABEL_EMPTY: 'A label is required.',
    LABEL_TOO_LONG: 'The label must be at most 50 characters.',
    URL_EMPTY: 'A URL is required.',
    URL_TOO_LONG: 'The URL must be at most 2048 characters.',
    URL_INVALID: 'Enter a valid http or https URL.',
    CAP_REACHED: 'You have reached the maximum of ' + MAX_QUICK_LINKS +
      ' quick links.',
    NOT_SAVED: 'The quick link could not be saved.'
  };

  var QuickLinksModule = {
    // Internal state — the in-memory quick-link set (source of truth).
    links: [],

    // Cached DOM references, resolved in init().
    _listEl: null,
    _formEl: null,
    _labelEl: null,
    _urlEl: null,
    _errorEl: null,

    // Monotonic counter used as a fallback for generating unique ids.
    _idCounter: 0,

    /**
     * Resolve the quick-link section's DOM elements, load any stored set, and
     * render it (Requirements 8.5, 8.8). A missing key yields an empty set; a
     * read or parse failure silently falls back to an empty set without raising
     * an unhandled error. Also wires the add form and the list's delegated
     * click handler.
     * @param {Element|Document} [rootEl] optional scope; defaults to document.
     * @returns {void}
     */
    init: function (rootEl) {
      var scope = rootEl && typeof rootEl.querySelector === 'function'
        ? rootEl
        : (typeof global.document !== 'undefined' ? global.document : null);

      if (scope && typeof scope.querySelector === 'function') {
        this._listEl = scope.querySelector('#links-list');
        this._formEl = scope.querySelector('#links-form');
        this._labelEl = scope.querySelector('#link-label-input');
        this._urlEl = scope.querySelector('#link-url-input');
        this._errorEl = scope.querySelector('#links-error');
      }

      // Load the stored set. Missing key → empty set (Req 8.5); read/parse
      // failure → empty set, handled silently (Req 8.8).
      var result = StorageService.load(STORAGE_KEYS.QUICK_LINKS);
      if (result.ok) {
        this.links = normalizeLinks(result.value);
      } else {
        // 'parse' / 'unavailable' → silent empty fallback (Req 8.8).
        this.links = [];
      }

      var self = this;

      // Wire the add form so submitting adds a quick link (Requirement 8.1).
      if (this._formEl && typeof this._formEl.addEventListener === 'function') {
        this._formEl.addEventListener('submit', function (event) {
          if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          var label = self._labelEl ? self._labelEl.value : '';
          var url = self._urlEl ? self._urlEl.value : '';
          var addResult = self.addLink(label, url);
          if (addResult.ok) {
            if (self._labelEl) {
              self._labelEl.value = '';
            }
            if (self._urlEl) {
              self._urlEl.value = '';
            }
          }
        });
      }

      // Delegate open/delete handling to the list so every current and future
      // item is covered without re-binding after each render (Requirement 8.4).
      if (this._listEl && typeof this._listEl.addEventListener === 'function') {
        this._listEl.addEventListener('click', function (event) {
          self._handleListClick(event);
        });
      }

      this.render();
    },

    /**
     * Delegated click handler for the quick-link list. Resolves the clicked
     * control's action ('open' or 'delete') and its owning link id, then
     * dispatches to openLink/deleteLink. Clicks outside a control are ignored.
     * Internal.
     * @param {Event} event
     * @returns {void}
     */
    _handleListClick: function (event) {
      var target = event ? event.target : null;
      if (!target || typeof target.getAttribute !== 'function') {
        return;
      }
      var action = target.getAttribute('data-action');
      if (action !== 'open' && action !== 'delete') {
        return;
      }
      var item = target.closest ? target.closest('.links__item') : null;
      var id = item ? item.getAttribute('data-id') : null;
      if (!id) {
        return;
      }
      if (action === 'open') {
        this.openLink(id);
      } else {
        this.deleteLink(id);
      }
    },

    /**
     * Add a new quick link from raw label + URL input. Validates the label and
     * URL first, then enforces the 50-link cap before creation; on success
     * creates a link with the trimmed label and URL, appends it to the
     * in-memory set, renders, then persists (Requirements 8.1, 8.4, 8.7).
     * Invalid input is rejected without mutating the set and surfaces a
     * field-specific error (Requirement 8.6). An over-cap addition is rejected
     * with a maximum-reached error (Requirement 8.7). A persistence failure
     * keeps the in-memory change and shows a "not saved" error (Requirement
     * 8.4).
     * @param {string} label raw label input.
     * @param {string} url raw URL input.
     * @returns {{ok: boolean, id?: string, reason?: string, field?: string}}
     *   ok:true with the new link id on success; otherwise ok:false with a
     *   reason and, for validation failures, the offending field
     *   ('label' | 'url').
     */
    addLink: function (label, url) {
      // Validate the label first, then the URL, so the error names the first
      // offending field (Requirement 8.6).
      var labelResult = Utilities.validateLabel(label);
      if (!labelResult.ok) {
        this._showError(labelMessageForReason(labelResult.reason));
        return { ok: false, reason: labelResult.reason, field: 'label' };
      }

      var urlResult = Utilities.validateUrl(url);
      if (!urlResult.ok) {
        this._showError(urlMessageForReason(urlResult.reason));
        return { ok: false, reason: urlResult.reason, field: 'url' };
      }

      // Enforce the 50-link cap before creating the link (Requirement 8.7).
      if (this.links.length >= MAX_QUICK_LINKS) {
        this._showError(LINKS_MESSAGES.CAP_REACHED);
        return { ok: false, reason: 'cap_reached' };
      }

      this._clearError();

      // In-memory update first so the UI reflects the change immediately.
      var link = {
        id: this._nextId(),
        label: labelResult.value,
        url: urlResult.value
      };
      this.links.push(link);
      this.render();

      // Persist; on failure keep the in-memory change and warn (Req 8.4).
      var saved = this._persist();
      if (!saved.ok) {
        this._showError(LINKS_MESSAGES.NOT_SAVED);
        return { ok: false, id: link.id, reason: 'not_saved' };
      }
      return { ok: true, id: link.id };
    },

    /**
     * Open the target URL of a quick link in a new browser tab via
     * window.open(url, '_blank', 'noopener') (Requirement 8.2). Opening a
     * non-existent id is a no-op.
     * @param {string} id the target link id.
     * @returns {{ok: boolean, reason?: string}}
     *   ok:true when the link was opened; otherwise ok:false with reason
     *   'not_found'.
     */
    openLink: function (id) {
      var link = this._findLink(id);
      if (!link) {
        return { ok: false, reason: 'not_found' };
      }
      if (typeof global.open === 'function') {
        global.open(link.url, '_blank', 'noopener');
      }
      return { ok: true };
    },

    /**
     * Remove exactly the targeted quick link, leaving all other links — and
     * their order — unchanged (Requirement 8.3). The in-memory removal happens
     * first and the list re-renders, then the updated set is persisted
     * (Requirement 8.4). Deleting a non-existent id leaves the set unchanged.
     * A persistence failure retains the in-memory removal and warns
     * (Requirement 8.4).
     * @param {string} id the target link id.
     * @returns {{ok: boolean, reason?: string}}
     *   ok:true on success; otherwise ok:false with reason
     *   'not_found' | 'not_saved'.
     */
    deleteLink: function (id) {
      var index = this._indexOfLink(id);
      if (index === -1) {
        // Non-existent id → leave the set unchanged.
        return { ok: false, reason: 'not_found' };
      }

      this._clearError();

      // In-memory removal of exactly the targeted link, preserving the order
      // and content of the remaining links (Req 8.3), then render.
      this.links.splice(index, 1);
      this.render();

      // Persist; on failure keep the in-memory removal and warn (Req 8.4).
      var saved = this._persist();
      if (!saved.ok) {
        this._showError(LINKS_MESSAGES.NOT_SAVED);
        return { ok: false, reason: 'not_saved' };
      }
      return { ok: true };
    },

    /**
     * Render the quick-link set into the list element. Each item carries a
     * stable data-id and provides an open control (labeled with the link's
     * label) plus a delete control. No-op when no list element is present.
     * @returns {void}
     */
    render: function () {
      if (!this._listEl) {
        return;
      }
      // Clear the current contents.
      this._listEl.textContent = '';

      var doc = this._listEl.ownerDocument ||
        (typeof global.document !== 'undefined' ? global.document : null);
      if (!doc) {
        return;
      }

      for (var i = 0; i < this.links.length; i += 1) {
        var link = this.links[i];

        var item = doc.createElement('li');
        item.className = 'links__item';
        item.setAttribute('data-id', link.id);

        // Open control — opens the target URL in a new tab (Req 8.2). Rendered
        // as a button so activation runs through openLink (which applies the
        // noopener flag) rather than a raw anchor.
        var open = doc.createElement('button');
        open.type = 'button';
        open.className = 'links__item-open';
        open.setAttribute('data-action', 'open');
        open.textContent = link.label;

        // Delete control — removes only this link (Req 8.3).
        var remove = doc.createElement('button');
        remove.type = 'button';
        remove.className = 'links__item-delete';
        remove.setAttribute('data-action', 'delete');
        remove.setAttribute('aria-label', 'Delete: ' + link.label);
        remove.textContent = 'Delete';

        item.appendChild(open);
        item.appendChild(remove);
        this._listEl.appendChild(item);
      }
    },

    /**
     * Persist the current in-memory quick-link set via StorageService
     * (Requirement 8.4). Internal.
     * @returns {{ok: boolean, reason?: string}}
     */
    _persist: function () {
      return StorageService.save(STORAGE_KEYS.QUICK_LINKS, this.links);
    },

    /**
     * Find a link by id, or null when absent. Internal.
     * @param {string} id
     * @returns {?object}
     */
    _findLink: function (id) {
      for (var i = 0; i < this.links.length; i += 1) {
        if (this.links[i].id === id) {
          return this.links[i];
        }
      }
      return null;
    },

    /**
     * Find the index of a link by id, or -1 when absent. Internal.
     * @param {string} id
     * @returns {number}
     */
    _indexOfLink: function (id) {
      for (var i = 0; i < this.links.length; i += 1) {
        if (this.links[i].id === id) {
          return i;
        }
      }
      return -1;
    },

    /**
     * Generate a stable unique id for a new link, preferring crypto.randomUUID
     * and falling back to a timestamp + monotonic counter. Internal.
     * @returns {string}
     */
    _nextId: function () {
      try {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
          return global.crypto.randomUUID();
        }
      } catch (e) {
        // Fall through to the timestamp-based id.
      }
      this._idCounter += 1;
      return 'l-' + Date.now() + '-' + this._idCounter;
    },

    /**
     * Show a message in the quick-link inline error region. Internal.
     * @param {string} message
     * @returns {void}
     */
    _showError: function (message) {
      if (this._errorEl) {
        this._errorEl.textContent = message;
        this._errorEl.hidden = false;
      }
    },

    /**
     * Clear and hide the quick-link inline error region. Internal.
     * @returns {void}
     */
    _clearError: function () {
      if (this._errorEl) {
        this._errorEl.textContent = '';
        this._errorEl.hidden = true;
      }
    }
  };

  /**
   * Map a label validation failure reason to a user-facing message.
   * @param {string} reason 'empty' | 'too_long'
   * @returns {string}
   */
  function labelMessageForReason(reason) {
    return reason === 'too_long'
      ? LINKS_MESSAGES.LABEL_TOO_LONG
      : LINKS_MESSAGES.LABEL_EMPTY;
  }

  /**
   * Map a URL validation failure reason to a user-facing message.
   * @param {string} reason 'empty' | 'too_long' | 'invalid'
   * @returns {string}
   */
  function urlMessageForReason(reason) {
    if (reason === 'too_long') {
      return LINKS_MESSAGES.URL_TOO_LONG;
    }
    if (reason === 'invalid') {
      return LINKS_MESSAGES.URL_INVALID;
    }
    return LINKS_MESSAGES.URL_EMPTY;
  }

  /**
   * Normalize a loaded value into a well-formed quick-link array. Tolerates a
   * missing or malformed stored value by dropping entries that are not shaped
   * like a Quick_Link, coercing label and url to strings. Restored label and
   * url match the saved values (Requirement 8.5).
   * @param {*} value the value returned by StorageService.load
   * @returns {Array<{id: string, label: string, url: string}>}
   */
  function normalizeLinks(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    var links = [];
    for (var i = 0; i < value.length && links.length < MAX_QUICK_LINKS; i += 1) {
      var entry = value[i];
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      if (typeof entry.label !== 'string' || typeof entry.url !== 'string') {
        continue;
      }
      links.push({
        id: typeof entry.id === 'string' && entry.id.length > 0
          ? entry.id
          : 'l-' + Date.now() + '-' + i,
        label: entry.label,
        url: entry.url
      });
    }
    return links;
  }

  // ---------------------------------------------------------------------------
  // ThemeModule — light/dark mode toggle (challenge). The selected theme is
  // applied by toggling a `theme-dark` class on the document's root element and
  // is persisted via StorageService so it is restored on the next load. When
  // no theme has been stored the light theme is used.
  // ---------------------------------------------------------------------------
  var THEME_LIGHT = 'light';
  var THEME_DARK = 'dark';
  var THEME_DARK_CLASS = 'theme-dark';

  var ThemeModule = {
    theme: THEME_LIGHT,

    _toggleEl: null,
    _rootEl: null,

    /**
     * Resolve the toggle button and document root, restore any stored theme
     * (defaulting to light), apply it, then wire the toggle click.
     * @param {Element|Document} [rootEl] optional scope; defaults to document.
     * @returns {void}
     */
    init: function (rootEl) {
      var doc = typeof global.document !== 'undefined' ? global.document : null;
      var scope = rootEl && typeof rootEl.querySelector === 'function'
        ? rootEl
        : doc;

      if (scope && typeof scope.querySelector === 'function') {
        this._toggleEl = scope.querySelector('#theme-toggle');
      }
      this._rootEl = doc ? doc.documentElement : null;

      // Restore the stored theme; a missing key or any failure falls back to
      // light.
      var result = StorageService.load(STORAGE_KEYS.THEME);
      this.theme = result.ok && result.value === THEME_DARK
        ? THEME_DARK
        : THEME_LIGHT;
      this._apply();

      var self = this;
      if (this._toggleEl &&
          typeof this._toggleEl.addEventListener === 'function') {
        this._toggleEl.addEventListener('click', function () {
          self.toggle();
        });
      }
    },

    /**
     * Flip between light and dark, apply, and persist the choice.
     * @returns {void}
     */
    toggle: function () {
      this.theme = this.theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
      this._apply();
      StorageService.save(STORAGE_KEYS.THEME, this.theme);
    },

    /**
     * Apply the current theme to the document root and sync the toggle's label
     * and pressed state. Internal.
     * @returns {void}
     */
    _apply: function () {
      var isDark = this.theme === THEME_DARK;
      if (this._rootEl && this._rootEl.classList) {
        if (isDark) {
          this._rootEl.classList.add(THEME_DARK_CLASS);
        } else {
          this._rootEl.classList.remove(THEME_DARK_CLASS);
        }
      }
      if (this._toggleEl) {
        // The button offers the action opposite to the current theme.
        this._toggleEl.textContent = isDark ? 'Light mode' : 'Dark mode';
        this._toggleEl.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // App / Bootstrap — the entry point run on DOMContentLoaded (design: App /
  // Bootstrap). It wires the four feature modules to their section containers
  // and owns the cross-cutting error banner shown for storage- and session-
  // level messages.
  //
  // Behavior:
  //   - Local Storage check: call StorageService.isAvailable(). When storage is
  //     unavailable or disabled, show a persistent "data will not be saved"
  //     banner but STILL initialize every module so the session stays usable
  //     (Requirements 9.6, 10.6 preserve access to stored data).
  //   - Browser-support check: feature-detect the APIs the dashboard relies on.
  //     When the browser is unsupported, show an "unsupported browser" banner
  //     while still initializing the modules so any already-stored data remains
  //     accessible (Requirement 10.6).
  //   - Initialize GreetingModule, FocusTimerModule, TodoListModule, and
  //     QuickLinksModule, each scoped to its own section container so the
  //     features stay loosely coupled (design goal).
  // ---------------------------------------------------------------------------

  // IDs of the four labeled section containers defined in index.html. Each
  // feature module is initialized against its own container.
  var SECTION_IDS = {
    GREETING: 'greeting-section',
    TIMER: 'timer-section',
    TODO: 'todo-section',
    LINKS: 'links-section'
  };

  var APP_BANNER_ID = 'app-banner'; // shared storage/session banner (index.html)

  // Cross-cutting banner messages (design: Error Handling — shared banner).
  var APP_MESSAGES = {
    STORAGE_UNAVAILABLE:
      'Local storage is unavailable, so your data will not be saved this ' +
      'session.',
    UNSUPPORTED_BROWSER:
      'This browser is unsupported. Some features may not work as expected; ' +
      'your already-saved data is still available.'
  };

  var App = {
    /**
     * Bootstrap the dashboard. Detects Local Storage availability and browser
     * support, surfacing a persistent banner for either problem, then
     * initializes every feature module regardless so the session stays usable
     * and any already-stored data remains accessible (Requirements 9.6, 10.6).
     * @param {Document} [doc] optional document scope; defaults to the global
     *   document. Injectable so the bootstrap can be exercised under a test
     *   runner.
     * @returns {void}
     */
    init: function (doc) {
      var document = doc ||
        (typeof global.document !== 'undefined' ? global.document : null);
      if (!document) {
        return;
      }

      var messages = [];

      // Browser-support check first. An unsupported browser still initializes
      // the modules so stored data stays accessible (Requirement 10.6).
      if (!this.isBrowserSupported()) {
        messages.push(APP_MESSAGES.UNSUPPORTED_BROWSER);
      }

      // Local Storage availability. When unavailable, warn that data will not
      // persist but continue initializing every module (Requirement 9.6).
      if (!StorageService.isAvailable()) {
        messages.push(APP_MESSAGES.STORAGE_UNAVAILABLE);
      }

      if (messages.length > 0) {
        this._showBanner(document, messages.join(' '));
      }

      // Theme toggle lives in the topbar (outside the section containers), so
      // it is initialized against the whole document (challenge: light/dark).
      try {
        ThemeModule.init(document);
      } catch (e) {
        // A theme failure must not prevent the rest of the bootstrap.
      }

      // Initialize each feature module against its own section container so a
      // change in one feature does not affect the others (design goal).
      this._initModule(GreetingModule, document, SECTION_IDS.GREETING);
      this._initModule(FocusTimerModule, document, SECTION_IDS.TIMER);
      this._initModule(TodoListModule, document, SECTION_IDS.TODO);
      this._initModule(QuickLinksModule, document, SECTION_IDS.LINKS);
    },

    /**
     * Feature-detect the browser APIs the dashboard relies on to decide whether
     * the current browser is supported. Uses capability detection rather than a
     * user-agent version string so the check stays robust and does not degrade
     * on unknown-but-capable browsers (Requirement 10.6). The presence of these
     * modern APIs (URL parsing, addEventListener, querySelector, Array.isArray,
     * JSON) tracks the two-most-recent-stable-versions baseline in practice.
     * @returns {boolean} true when the browser exposes the required APIs.
     */
    isBrowserSupported: function () {
      try {
        return typeof global.URL === 'function' &&
          typeof global.document !== 'undefined' && !!global.document &&
          typeof global.document.querySelector === 'function' &&
          typeof global.document.addEventListener === 'function' &&
          typeof Array.isArray === 'function' &&
          typeof JSON !== 'undefined' &&
          typeof JSON.parse === 'function';
      } catch (e) {
        return false;
      }
    },

    /**
     * Initialize a feature module against a section container resolved by id,
     * falling back to the document when the container is absent so the module
     * still initializes. Guarded so one module failing to init does not abort
     * the bootstrap of the others. Internal.
     * @param {{init: function}} module the feature module to initialize.
     * @param {Document} document the document scope.
     * @param {string} sectionId the section container id.
     * @returns {void}
     */
    _initModule: function (module, document, sectionId) {
      if (!module || typeof module.init !== 'function') {
        return;
      }
      var container = typeof document.getElementById === 'function'
        ? document.getElementById(sectionId)
        : null;
      try {
        module.init(container || document);
      } catch (e) {
        // A single module failing to initialize must not prevent the others
        // from coming up (design: failures degrade gracefully).
      }
    },

    /**
     * Show a persistent message in the shared app banner (Requirements 9.6,
     * 10.6). The banner stays visible (no auto-dismiss) so the storage/session
     * warning remains for the session. Internal.
     * @param {Document} document the document scope.
     * @param {string} message the message to display.
     * @returns {void}
     */
    _showBanner: function (document, message) {
      var banner = typeof document.getElementById === 'function'
        ? document.getElementById(APP_BANNER_ID)
        : null;
      if (banner) {
        banner.textContent = message;
        banner.hidden = false;
      }
    }
  };

  // Run the bootstrap on DOMContentLoaded so the DOM is ready before modules
  // resolve their elements. If the document has already finished parsing (for
  // example, when the deferred script runs after DOMContentLoaded), initialize
  // immediately.
  if (typeof global.document !== 'undefined' && global.document) {
    if (global.document.readyState === 'loading' &&
        typeof global.document.addEventListener === 'function') {
      global.document.addEventListener('DOMContentLoaded', function () {
        App.init(global.document);
      });
    } else {
      App.init(global.document);
    }
  }

  // ---------------------------------------------------------------------------
  // Namespace export — guarded so the Utilities work both in the browser and
  // under a test runner. In the browser we attach to the global object; under
  // CommonJS (e.g. a Node-based property-test runner) we also expose via
  // module.exports so the optional property tests can import it.
  // ---------------------------------------------------------------------------
  var Dashboard = global.Dashboard || {};
  Dashboard.Utilities = Utilities;
  Dashboard.StorageService = StorageService;
  Dashboard.FocusTimerModule = FocusTimerModule;
  Dashboard.GreetingModule = GreetingModule;
  Dashboard.TodoListModule = TodoListModule;
  Dashboard.QuickLinksModule = QuickLinksModule;
  Dashboard.ThemeModule = ThemeModule;
  Dashboard.App = App;
  Dashboard.STORAGE_KEYS = STORAGE_KEYS;
  global.Dashboard = Dashboard;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dashboard;
  }
})(typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof self !== 'undefined' ? self : this));
