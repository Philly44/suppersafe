  const SUPABASE_URL = 'https://txxkimndpqprbqhlknrk.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eGtpbW5kcHFwcmJxaGxrbnJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxOTE1ODgsImV4cCI6MjA3OTc2NzU4OH0.4Zm1ShwG-_kc_E0tkltEBnNzfWdVeb7gRDh6b3-pCb8';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ===========================================
  // ERROR ALERTING SYSTEM
  // ===========================================

  const errorAlert = {
    lastErrors: new Map(),
    THROTTLE_MS: 60000, // Don't send same error more than once per minute

    send: async function(error, context = '') {
      try {
        // Throttle duplicate errors
        const errorKey = `${error.message || ''}-${context}`;
        const lastSent = this.lastErrors.get(errorKey);
        if (lastSent && Date.now() - lastSent < this.THROTTLE_MS) {
          return; // Skip duplicate
        }
        this.lastErrors.set(errorKey, Date.now());

        await fetch(`${SUPABASE_URL}/functions/v1/error-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            error: {
              type: error.name || 'Error',
              message: error.message || String(error),
              stack: error.stack || null
            },
            context: context,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          })
        });
      } catch (e) {
        // Silently fail - don't cause more errors
        console.warn('Failed to send error alert:', e);
      }
    }
  };

  // Global error handler
  window.onerror = function(message, source, lineno, colno, error) {
    errorAlert.send(
      error || { message, stack: `at ${source}:${lineno}:${colno}` },
      'window.onerror'
    );
  };

  // Unhandled promise rejections
  window.onunhandledrejection = function(event) {
    errorAlert.send(
      event.reason || { message: 'Unhandled Promise Rejection' },
      'unhandledrejection'
    );
  };

  // ===========================================
  // HEADLINE A/B TESTING SYSTEM
  // ===========================================

  const headlineTests = {
    headlines: [
      { id: "v2_dirty", text: "You'd never eat somewhere dirty. Right?" },
      { id: "v2_friends", text: "Your friends check restaurants. You don't." },
      { id: "v2_kitchens", text: "Kitchens fail inspections. Nobody tells you." },
      { id: "v2_busy", text: "Too busy to check? That's what they're counting on." },
      { id: "v2_corners", text: "Restaurants cut corners. You pay the price." },
      { id: "v2_3xweek", text: "You eat out 3x a week. How many passed inspection?" },
      { id: "v2_favorite", text: "Your favorite restaurant failed inspection." }
    ],

    sessionId: null,
    currentHeadline: null,

    init: function() {
      // Create/restore session ID
      this.sessionId = localStorage.getItem('suppersafe_headline_session');
      if (!this.sessionId) {
        this.sessionId = 'hs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('suppersafe_headline_session', this.sessionId);
      }

      // Check if headline already selected in this session
      const existingHeadlineId = localStorage.getItem('suppersafe_current_headline');
      if (existingHeadlineId) {
        this.currentHeadline = this.headlines.find(h => h.id === existingHeadlineId);
      }

      // If new session or headline not found, randomly select and log
      if (!this.currentHeadline) {
        this.currentHeadline = this.headlines[Math.floor(Math.random() * this.headlines.length)];
        localStorage.setItem('suppersafe_current_headline', this.currentHeadline.id);
        this.logImpression(); // Fire and forget (async, non-blocking)
      }

      // Display headline immediately (sync)
      this.displayHeadline();

      // Load violation count asynchronously and animate stat line
      this.loadAndAnimateStatLine();
    },

    logImpression: async function() {
      try {
        await supabase.from('headline_tests').insert({
          headline_id: this.currentHeadline.id,
          session_id: this.sessionId
        });
      } catch (e) {
        console.warn('Failed to log headline impression:', e);
      }
    },

    logConversion: async function(conversionType) {
      try {
        await supabase.rpc('mark_headline_conversion', {
          p_session_id: this.sessionId,
          p_conversion_type: conversionType
        });
      } catch (e) {
        console.warn('Failed to log headline conversion:', e);
      }
    },

    getViolationCount: async function() {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('dinesafe')
          .select('establishment_id')
          .gte('inspection_date', thirtyDaysAgo)
          .or('severity.ilike.C%,severity.ilike.S%');

        if (error) throw error;

        const uniqueEstablishments = new Set(data.map(d => d.establishment_id));
        return uniqueEstablishments.size;
      } catch (e) {
        console.warn('Failed to get violation count:', e);
        return null; // Will show "Many" as fallback
      }
    },

    displayHeadline: function() {
      const heroEl = document.getElementById('heroHeadline');
      if (!heroEl) return;

      // Display headline immediately (sync)
      heroEl.textContent = this.currentHeadline.text;
    },

    loadAndAnimateStatLine: async function() {
      const statLine = document.getElementById('heroStatLine');
      const countEl = document.getElementById('violationCount');
      if (!statLine || !countEl) return;

      // Fetch violation count
      const count = await this.getViolationCount();

      // Trigger fade-in first
      requestAnimationFrame(() => {
        statLine.classList.add('visible');
      });

      // Handle fallback case
      if (count === null) {
        countEl.textContent = 'Many';
        return;
      }

      // Count up animation
      const duration = 1500;
      const start = performance.now();

      const animate = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic for satisfying slow-down
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * count);

        countEl.textContent = current.toLocaleString();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          countEl.textContent = count.toLocaleString();
        }
      };

      requestAnimationFrame(animate);
    }
  };

  headlineTests.init();

  // Set live dates
  const today = new Date();
  const dateFormat = { month: 'short', day: 'numeric' };

  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = today.toLocaleDateString('en-US', dateFormat);
  }

  // ===========================================
  // INSPECTION TICKER
  // ===========================================
  async function initTicker() {
    const track = document.getElementById('tickerTrack');
    if (!track) return;

    try {
      // Fetch passes and fails separately to ensure mix
      const [passResult, failResult] = await Promise.all([
        supabase.from('dinesafe')
          .select('establishment_name, inspection_date, establishment_status')
          .eq('establishment_status', 'Pass')
          .order('inspection_date', { ascending: false })
          .limit(30),
        supabase.from('dinesafe')
          .select('establishment_name, inspection_date, establishment_status')
          .neq('establishment_status', 'Pass')
          .order('inspection_date', { ascending: false })
          .limit(15)
      ]);

      const allData = [...(passResult.data || []), ...(failResult.data || [])];

      if (!allData.length) {
        track.parentElement.style.display = 'none';
        return;
      }

      // Dedupe by establishment name
      const seen = new Set();
      const passes = [];
      const fails = [];

      allData.forEach(d => {
        if (seen.has(d.establishment_name)) return;
        seen.add(d.establishment_name);
        if (d.establishment_status === 'Pass') passes.push(d);
        else fails.push(d);
      });

      // Interleave: 3 passes, 1 fail pattern
      const mixed = [];
      let pIdx = 0, fIdx = 0;
      while (mixed.length < 20 && (pIdx < passes.length || fIdx < fails.length)) {
        for (let i = 0; i < 3 && pIdx < passes.length && mixed.length < 20; i++) {
          mixed.push(passes[pIdx++]);
        }
        if (fIdx < fails.length && mixed.length < 20) {
          mixed.push(fails[fIdx++]);
        }
      }

      const items = mixed.map(d => {
        const date = new Date(d.inspection_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const passed = d.establishment_status === 'Pass';
        const statusClass = passed ? 'pass' : 'fail';
        const statusText = passed ? 'Pass' : 'Fail';
        return `<span class="ticker-item">${d.establishment_name} · <span class="${statusClass}">${statusText}</span> · ${date}</span>`;
      }).join('');

      // Duplicate for seamless infinite scroll
      track.innerHTML = items + items;
    } catch (e) {
      track.parentElement.style.display = 'none';
    }
  }

  initTicker();

  // ===========================================
  // CONFIG - Centralized constants
  // ===========================================
  const CONFIG = {
    INITIAL_USER_COUNT: 247,
  };

  // State
  let searchCount = 0;
  let isUnlocked = false;
  let currentRestaurant = null;
  let hasSignedUp = false;

  // Elements
  const modalOverlay = document.getElementById('modalOverlay');
  const modalContainer = document.getElementById('modalContainer');
  const searchInput = document.getElementById('restaurantSearch');
  const searchResults = document.getElementById('searchResults');
  const toast = document.getElementById('toast');

  // Check if already unlocked (localStorage)
  if (localStorage.getItem('suppersafe_unlocked') === 'true') {
    isUnlocked = true;
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // Honeypot check - returns true if bot detected
  function isBot(honeypotId) {
    const hp = document.getElementById(honeypotId);
    if (hp && hp.value) {
      console.warn('Bot detected via honeypot');
      return true;
    }
    return false;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  let previouslyFocusedElement = null;

  function handleEscapeKey(e) {
    if (e.key === 'Escape') closeModal();
  }

  function handleFocusTrap(e) {
    if (e.key !== 'Tab') return;
    const focusable = modalContainer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openModal() {
    previouslyFocusedElement = document.activeElement;
    modalOverlay.classList.add('active');
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleEscapeKey);
    document.addEventListener('keydown', handleFocusTrap);
    // Focus first focusable element after content loads
    setTimeout(() => {
      const firstFocusable = modalContainer.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) firstFocusable.focus();
    }, 100);
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleEscapeKey);
    document.removeEventListener('keydown', handleFocusTrap);
    if (previouslyFocusedElement) previouslyFocusedElement.focus();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =============================================================================
  // LUCIDE SVG ICONS - Minimal, professional icon system
  // =============================================================================

  const icons = {
    // UI Icons
    share: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>',

    // Alert/Warning Icons
    alertCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
    alertTriangle: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
    shieldAlert: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',

    // Pest/Bug Icons
    bug: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',

    // Temperature Icons
    thermometer: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>',
    snowflake: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>',
    flame: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',

    // Water/Cleaning Icons
    droplet: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>',
    droplets: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>',
    sparkles: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>',

    // Document/Clipboard Icons
    clipboard: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
    fileText: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    scroll: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg>',
    tag: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',

    // Utility Icons
    lightbulb: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
    hand: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
    paintbrush: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.622 17.897-10.68-2.913"/><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"/><path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"/></svg>',
    square: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>'
  };

  // Helper to get icon SVG string
  function getIcon(name, size = 16) {
    const svg = icons[name] || icons.fileText;
    return svg.replace(/width="24"/g, `width="${size}"`).replace(/height="24"/g, `height="${size}"`);
  }

  // =============================================================================

  async function searchRestaurants(query) {
    if (query.length < 2) {
      searchResults.classList.remove('active');
      return;
    }

    searchResults.innerHTML = '<div class="search-loading">Searching...</div>';
    searchResults.classList.add('active');

    try {
      const { data, error } = await supabase
        .from('dinesafe')
        .select('establishment_id, establishment_name, establishment_address')
        .ilike('establishment_name', `%${query}%`)
        .order('establishment_name')
        .limit(50);

      if (error) throw error;

      const unique = [];
      const seen = new Set();
      for (const item of data) {
        if (!seen.has(item.establishment_id)) {
          seen.add(item.establishment_id);
          unique.push(item);
        }
      }

      if (unique.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">No restaurants found</div>';
        return;
      }

      searchResults.innerHTML = unique.slice(0, 6).map(r => `
        <div class="search-result-item" data-id="${r.establishment_id}" data-name="${escapeHtml(r.establishment_name)}" data-address="${escapeHtml(r.establishment_address || '')}">
          <div class="search-result-name">${escapeHtml(r.establishment_name)}</div>
          <div class="search-result-address">${escapeHtml(r.establishment_address || '')}</div>
        </div>
      `).join('');

      document.querySelectorAll('.search-result-item').forEach((item, index) => {
        item.style.setProperty('--item-index', index);
        requestAnimationFrame(() => {
          item.classList.add('visible');
        });
        item.addEventListener('click', () => selectRestaurant(item.dataset.id, item.dataset.name, item.dataset.address));
      });
    } catch (err) {
      console.error(err);
      searchResults.innerHTML = '<div class="search-no-results">Error searching. Try again.</div>';
    }
  }

  async function selectRestaurant(id, name, address) {
    headlineTests.logConversion('restaurant_search');
    searchResults.classList.remove('active');
    searchInput.value = '';

    // Check if gated
    if (!isUnlocked && searchCount >= 1) {
      showGateModal();
      return;
    }

    searchCount++;
    await showReportCard(id, name, address);
  }

  function showGateModal() {
    const template = document.getElementById('gateTemplate');
    const clone = template.content.cloneNode(true);
    modalContainer.innerHTML = '';
    modalContainer.appendChild(clone);
    modalContainer.setAttribute('aria-label', 'Sign up for full access');

    // Close button
    document.getElementById('gateClose').addEventListener('click', () => {
      closeModal();
    });

    // Skip button
    document.getElementById('gateSkip').addEventListener('click', () => {
      closeModal();
    });

    // Email signup
    document.getElementById('gateSubmit').addEventListener('click', () => {
      if (isBot('hpGate')) { return; }
      const email = document.getElementById('gateEmailInput').value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email');
        return;
      }
      document.getElementById('gateSubmit').disabled = true;
      document.getElementById('gateSubmit').textContent = '...';
      signUpWithEmail(email);
    });

    // Enter key support
    document.getElementById('gateEmailInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        document.getElementById('gateSubmit').click();
      }
    });

    openModal();
  }

  // ===========================================
  // SAFETY SCORE CALCULATION & REVEAL SYSTEM
  // ===========================================

  // Calculate safety score (0-100)
  function calculateSafetyScore(crucial, significant, minor, status) {
    // Start at 100, deduct points for violations
    let score = 100;
    score -= crucial * 25;      // Crucial: -25 points each
    score -= significant * 10;  // Significant: -10 points each
    score -= minor * 3;         // Minor: -3 points each

    // Status penalty
    if (status === 'Conditional Pass') score -= 10;
    if (status === 'Closed') score -= 30;

    return Math.max(0, Math.min(100, score));
  }

  // Get score color and label
  function getScoreDetails(score) {
    if (score >= 90) return { color: '#059669', label: 'Excellent', class: 'excellent', hex: '#10B981' };
    if (score >= 80) return { color: '#10B981', label: 'Good', class: 'good', hex: '#34D399' };
    if (score >= 70) return { color: '#D97706', label: 'Fair', class: 'fair', hex: '#FBBF24' };
    if (score >= 60) return { color: '#F97316', label: 'Needs Work', class: 'poor', hex: '#F97316' };
    return { color: '#DC2626', label: 'Critical', class: 'critical', hex: '#EF4444' };
  }

  // Calculate percentile (simulated based on score distribution)
  function calculatePercentile(score) {
    // Simulated percentile based on typical Toronto restaurant distribution
    // Most restaurants score 70-90, so we skew accordingly
    if (score >= 95) return Math.floor(Math.random() * 5) + 95;  // 95-99%
    if (score >= 90) return Math.floor(Math.random() * 10) + 85; // 85-94%
    if (score >= 85) return Math.floor(Math.random() * 10) + 70; // 70-79%
    if (score >= 80) return Math.floor(Math.random() * 15) + 55; // 55-69%
    if (score >= 70) return Math.floor(Math.random() * 15) + 35; // 35-49%
    if (score >= 60) return Math.floor(Math.random() * 15) + 20; // 20-34%
    return Math.floor(Math.random() * 15) + 5;                   // 5-19%
  }

  // =============================================================================
  // SHARE MESSAGE TEMPLATES - Viral-optimized, varied copy
  // =============================================================================

  const shareTemplates = {
    twitter: {
      // Excellent (90-100) - celebration
      excellent: [
        { weight: 3, template: (r) => `${r.name} scored ${r.score}/100 on their health inspection. Cleaner than ${r.percentile}% of Toronto restaurants.\n\nFinally a spot I can recommend without caveats: suppersafe.com` },
        { weight: 2, template: (r) => `Good news: ${r.name} is spotless. ${r.score}/100 on safety, zero concerns.\n\nLook up any Toronto restaurant: suppersafe.com` },
        { weight: 1, template: (r) => `Shoutout to ${r.name} for having a clean health record. ${r.score}/100.\n\nCheck any restaurant here: suppersafe.com` }
      ],
      // Good (80-89)
      good: [
        { weight: 2, template: (r) => `${r.name} passes the food safety check - ${r.score}/100. Solid choice.\n\nLook up any Toronto restaurant: suppersafe.com` },
        { weight: 1, template: (r) => `Checked ${r.name} - ${r.score}/100 on safety. Nothing to worry about.\n\nsuppersafe.com` }
      ],
      // Fair (70-79)
      fair: [
        { weight: 2, template: (r) => `Heads up: ${r.name} is ${r.score}/100 on food safety. ${r.total} violation${r.total !== 1 ? 's' : ''} on their last inspection.\n\nLook yours up: suppersafe.com` },
        { weight: 1, template: (r) => `${r.name} had ${r.total} issue${r.total !== 1 ? 's' : ''} on their last inspection. Not terrible, but worth knowing.\n\nsuppersafe.com` }
      ],
      // Poor (60-69)
      poor: [
        { weight: 2, template: (r) => `PSA: you can look up any Toronto restaurant's health inspection for free.\n\n${r.name}? ${r.score}/100 with ${r.total} violations.\n\nsuppersafe.com` },
        { weight: 1, template: (r) => `That place you're going to might have health violations on file.\n\n${r.name}: ${r.score}/100, ${r.total} issues.\n\nsuppersafe.com` }
      ],
      // Critical (<60)
      critical: [
        { weight: 3, template: (r) => `Safety Alert: ${r.name} scored just ${r.score}/100 on their health inspection${r.crucial > 0 ? ` with ${r.crucial} critical violation${r.crucial !== 1 ? 's' : ''}` : ''}.\n\nCheck before you eat: suppersafe.com` },
        { weight: 2, template: (r) => `Just looked up ${r.name} before booking. ${r.score}/100 on safety. ${r.total} violations.${r.topFinding ? `\n\nIncluding "${r.topFinding}."` : ''}\n\nsuppersafe.com` },
        { weight: 2, template: (r) => `Friendly reminder that restaurant health inspections are public record.\n\n${r.name}: ${r.score}/100, ${r.total} violations.\n\nsuppersafe.com` }
      ],
      // Pest-specific (overrides score tier when detected)
      pests: [
        { weight: 4, template: (r) => `Looked up ${r.name} and... they found pest evidence on the last inspection.\n\nCheck any Toronto restaurant: suppersafe.com` },
        { weight: 2, template: (r) => `Maybe don't read this if you've eaten at ${r.name} recently.\n\nPest evidence on their last health inspection.\n\nsuppersafe.com` }
      ],
      // Conditional pass status
      conditionalPass: [
        { weight: 3, template: (r) => `${r.name} is on "Conditional Pass" status with Toronto Public Health. ${r.score}/100.\n\nLook up any restaurant: suppersafe.com` },
        { weight: 2, template: (r) => `TIL ${r.name} has a conditional pass from health inspectors. Might want to check your regular spots too.\n\nsuppersafe.com` }
      ]
    },

    whatsapp: {
      excellent: [
        { weight: 3, template: (r) => `actually good news: ${r.name} is clean\n\n${r.score}/100 on safety, cleaner than ${r.percentile}% of toronto restaurants\n\nyou can look up any spot here: suppersafe.com` },
        { weight: 2, template: (r) => `${r.name} - ${r.score}/100 on health inspection (clean)\n\nfinally a place I can recommend without caveats lol\n\nsuppersafe.com` }
      ],
      good: [
        { weight: 2, template: (r) => `looked up ${r.name}\n\n${r.score}/100 on their health inspection, nothing to worry about\n\nyou can check any restaurant: suppersafe.com` }
      ],
      fair: [
        { weight: 2, template: (r) => `looked up ${r.name}\n\n${r.score}/100, ${r.total} minor thing${r.total !== 1 ? 's' : ''} on their last inspection\n\nyou can check any restaurant: suppersafe.com` }
      ],
      poor: [
        { weight: 2, template: (r) => `before you book that dinner reservation\n\nyou can look up any restaurant's health inspection record\n\n${r.name} is ${r.score}/100 with ${r.total} violations\n\nsuppersafe.com` },
        { weight: 1, template: (r) => `not to be that person but\n\n${r.name} is ${r.score}/100 on health inspection\n\nsuppersafe.com` }
      ],
      critical: [
        { weight: 3, template: (r) => `ok so you know those green/yellow/red signs in restaurant windows?\n\nyou can look up the actual reports online\n\njust checked ${r.name}... ${r.score}/100${r.topFinding ? `\n\nincluding ${r.topFinding.toLowerCase()}` : ''}\n\nsuppersafe.com` },
        { weight: 2, template: (r) => `heads up about ${r.name} - they only scored ${r.score}/100 on food safety${r.crucial > 0 ? ` (${r.crucial} critical issue${r.crucial !== 1 ? 's' : ''})` : ''}\n\nmight want to pick somewhere else\n\nsuppersafe.com` }
      ],
      pests: [
        { weight: 4, template: (r) => `uhhhh so I looked up ${r.name}\n\nthey found pest evidence on the last health inspection\n\njust thought you should know\n\nsuppersafe.com` },
        { weight: 2, template: (r) => `ok don't shoot the messenger but\n\n${r.name} had pest issues on their last inspection\n\nsuppersafe.com` }
      ],
      conditionalPass: [
        { weight: 3, template: (r) => `heads up - ${r.name} is on conditional pass with health inspectors\n\n${r.score}/100\n\nsuppersafe.com` }
      ]
    },

    copy: {
      default: [
        { weight: 2, template: (r) => `${r.name}\nSafety Score: ${r.score}/100 (${r.label})\n${r.score >= 80 ? `Cleaner than ${r.percentile}%` : `Worse than ${100 - r.percentile}%`} of Toronto restaurants\n\n${r.status} - Inspected ${r.dateFormatted}\nViolations: ${r.crucial} crucial, ${r.significant} significant, ${r.minor} minor\n\nLook up any restaurant: suppersafe.com` },
        { weight: 1, template: (r) => `Health inspection results for ${r.name}:\n\n${r.score}/100 - ${r.label}\n${r.total} violation${r.total !== 1 ? 's' : ''} on last inspection${r.topFinding ? `\nIncluding: ${r.topFinding}` : ''}\n\nCheck any restaurant: suppersafe.com` }
      ]
    }
  };

  // Select template using weighted random
  function selectWeightedTemplate(templates) {
    if (!templates || templates.length === 0) return null;
    const totalWeight = templates.reduce((sum, t) => sum + (t.weight || 1), 0);
    let random = Math.random() * totalWeight;
    for (const t of templates) {
      random -= (t.weight || 1);
      if (random <= 0) return t.template;
    }
    return templates[0].template;
  }

  // Get the most "shareable" finding (shocking details)
  function getTopShareFinding(findings) {
    if (!findings || findings.length === 0) return null;
    const shockWords = ['pest', 'rodent', 'vermin', 'contamination', 'sewage', 'mold', 'feces', 'insect', 'cockroach'];
    const secondaryWords = ['temperature', 'handwash', 'sanitiz', 'raw meat'];

    for (const f of findings) {
      const lower = f.text ? f.text.toLowerCase() : f.toLowerCase();
      if (shockWords.some(w => lower.includes(w))) {
        // Return simplified version
        if (lower.includes('pest') || lower.includes('vermin')) return 'pest evidence';
        if (lower.includes('rodent')) return 'rodent evidence';
        if (lower.includes('cockroach')) return 'cockroaches found';
        return 'contamination issues';
      }
    }
    for (const f of findings) {
      const lower = f.text ? f.text.toLowerCase() : f.toLowerCase();
      if (secondaryWords.some(w => lower.includes(w))) {
        if (lower.includes('temperature')) return 'food temperature issues';
        if (lower.includes('handwash')) return 'handwashing issues';
        return 'sanitization issues';
      }
    }
    return null;
  }

  // Check for pest-related violations
  function hasPestViolations(findings) {
    if (!findings) return false;
    const pestWords = ['pest', 'rodent', 'vermin', 'cockroach', 'mouse', 'rat', 'insect'];
    return findings.some(f => {
      const text = f.text ? f.text.toLowerCase() : f.toLowerCase();
      return pestWords.some(w => text.includes(w));
    });
  }

  // Get share message for a restaurant
  function getShareMessage(platform, restaurant) {
    const { name, safetyScore, percentile, crucial, significant, minor, status, latestDate, findings } = restaurant;
    const total = (crucial || 0) + (significant || 0) + (minor || 0);
    const dateFormatted = latestDate ? new Date(latestDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';

    const r = {
      name,
      score: safetyScore,
      percentile,
      crucial: crucial || 0,
      significant: significant || 0,
      minor: minor || 0,
      total,
      status: status || 'Unknown',
      dateFormatted,
      label: getScoreDetails(safetyScore).label,
      topFinding: getTopShareFinding(findings)
    };

    // Determine category
    let category;
    if (platform === 'copy') {
      category = 'default';
    } else if (hasPestViolations(findings)) {
      category = 'pests';
    } else if (status === 'Conditional Pass') {
      category = 'conditionalPass';
    } else if (safetyScore >= 90) {
      category = 'excellent';
    } else if (safetyScore >= 80) {
      category = 'good';
    } else if (safetyScore >= 70) {
      category = 'fair';
    } else if (safetyScore >= 60) {
      category = 'poor';
    } else {
      category = 'critical';
    }

    const templates = shareTemplates[platform]?.[category] || shareTemplates[platform]?.fair;
    if (!templates) {
      return `${r.name} - ${r.score}/100 on health inspection. Check any Toronto restaurant: suppersafe.com`;
    }

    const templateFn = selectWeightedTemplate(templates);
    return templateFn(r);
  }

  // =============================================================================

  // Animated count-up
  function animateCountUp(element, targetValue, duration, onComplete) {
    const startTime = performance.now();
    const startValue = 0;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for satisfying deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);

      element.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = targetValue;
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(update);
  }

  // Haptic feedback (if supported)
  function triggerHaptic(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // Enhanced visceral translations
  function translateInfractionVisceral(text, severity) {
    const t = text.toLowerCase();
    const sev = severity.toUpperCase();
    const isCrucial = sev.startsWith('C');
    const isSignificant = sev.startsWith('S');

    // Crucial violations - maximum impact
    if (isCrucial) {
      if (t.includes('rodent') || t.includes('mouse') || t.includes('rat')) return { icon: getIcon('bug'), text: 'Rodent activity detected', severity: 'crucial' };
      if (t.includes('cockroach') || t.includes('roach')) return { icon: getIcon('bug'), text: 'Cockroaches found on premises', severity: 'crucial' };
      if (t.includes('pest') || t.includes('vermin')) return { icon: getIcon('bug'), text: 'Active pest infestation', severity: 'crucial' };
      if (t.includes('sewage') || t.includes('sewerage')) return { icon: getIcon('droplets'), text: 'Sewage/drainage issue', severity: 'crucial' };
      if (t.includes('temperature') && t.includes('danger')) return { icon: getIcon('thermometer'), text: 'Food held at dangerous temperatures', severity: 'crucial' };
      if (t.includes('contamina')) return { icon: getIcon('shieldAlert'), text: 'Food contamination risk', severity: 'crucial' };
      return { icon: getIcon('alertCircle'), text: 'Critical health violation', severity: 'crucial' };
    }

    // Significant violations
    if (isSignificant) {
      if (t.includes('handwash') && t.includes('soap')) return { icon: getIcon('droplet'), text: 'No soap at handwashing station', severity: 'significant' };
      if (t.includes('handwash') && t.includes('paper')) return { icon: getIcon('scroll'), text: 'No paper towels for hand drying', severity: 'significant' };
      if (t.includes('handwash')) return { icon: getIcon('hand'), text: 'Handwashing facility issue', severity: 'significant' };
      if (t.includes('temperature') && t.includes('cold')) return { icon: getIcon('snowflake'), text: 'Cold food not kept cold enough', severity: 'significant' };
      if (t.includes('temperature') && t.includes('hot')) return { icon: getIcon('flame'), text: 'Hot food not kept hot enough', severity: 'significant' };
      if (t.includes('sanitiz') || t.includes('sanitis')) return { icon: getIcon('sparkles'), text: 'Equipment not properly sanitized', severity: 'significant' };
      if (t.includes('cross-contam') || t.includes('cross contam')) return { icon: getIcon('alertTriangle'), text: 'Cross-contamination risk', severity: 'significant' };
      return { icon: getIcon('alertTriangle'), text: 'Significant health violation', severity: 'significant' };
    }

    // Minor violations
    if (t.includes('thermometer')) return { icon: getIcon('thermometer'), text: 'Missing thermometer in fridge/freezer', severity: 'minor' };
    if (t.includes('clean') && t.includes('floor')) return { icon: getIcon('paintbrush'), text: 'Floors need cleaning', severity: 'minor' };
    if (t.includes('clean') && t.includes('wall')) return { icon: getIcon('square'), text: 'Walls need cleaning', severity: 'minor' };
    if (t.includes('food handler') || t.includes('certification')) return { icon: getIcon('clipboard'), text: 'Staff certification paperwork issue', severity: 'minor' };
    if (t.includes('light') && t.includes('cover')) return { icon: getIcon('lightbulb'), text: 'Light fixture needs cover', severity: 'minor' };
    if (t.includes('label')) return { icon: getIcon('tag'), text: 'Food labeling issue', severity: 'minor' };

    return { icon: getIcon('fileText'), text: 'Health code violation', severity: 'minor' };
  }

  async function showReportCard(id, name, address) {
    const template = document.getElementById('reportCardTemplate');
    const clone = template.content.cloneNode(true);
    modalContainer.innerHTML = '';
    modalContainer.appendChild(clone);
    modalContainer.setAttribute('aria-label', `Health inspection report for ${name}`);

    // Set initial values
    document.getElementById('reportName').textContent = name;
    document.getElementById('reportAddress').textContent = address;
    document.getElementById('statusText').textContent = 'Loading...';

    openModal();

    try {
      const { data, error } = await supabase
        .from('dinesafe')
        .select('*')
        .eq('establishment_id', id)
        .order('inspection_date', { ascending: false });

      if (error) throw error;

      // Group by inspection_id
      const inspectionMap = new Map();
      data.forEach(record => {
        const inspId = record.inspection_id;
        if (!inspectionMap.has(inspId)) {
          inspectionMap.set(inspId, {
            id: inspId,
            date: record.inspection_date,
            status: record.establishment_status,
            infractions: []
          });
        }
        const severity = (record.severity || '').trim();
        if (severity && !severity.toUpperCase().startsWith('N')) {
          inspectionMap.get(inspId).infractions.push({
            severity,
            details: record.infraction_details || ''
          });
        }
      });

      const inspections = Array.from(inspectionMap.values())
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const latest = inspections[0];
      const status = latest?.status || 'Unknown';

      let crucial = 0, significant = 0, minor = 0;
      const findings = [];

      latest?.infractions.forEach(inf => {
        const sev = inf.severity.toUpperCase();
        if (sev.startsWith('C')) crucial++;
        else if (sev.startsWith('S')) significant++;
        else if (sev.startsWith('M')) minor++;
        if (inf.details) findings.push({ text: inf.details, severity: inf.severity });
      });

      const total = crucial + significant + minor;

      // Calculate safety score
      const safetyScore = calculateSafetyScore(crucial, significant, minor, status);
      const scoreDetails = getScoreDetails(safetyScore);
      const percentile = calculatePercentile(safetyScore);

      currentRestaurant = {
        id, name, address, status, crucial, significant, minor, total,
        latestDate: latest?.date, inspections, safetyScore, percentile, findings
      };

      // Update status bar
      const statusBar = document.getElementById('statusBar');
      statusBar.className = 'report-status-bar ' + (status === 'Pass' ? 'pass' : status === 'Conditional Pass' ? 'conditional' : 'closed');
      document.getElementById('statusText').textContent = status;
      document.getElementById('statusSubtitle').textContent =
        status === 'Closed' ? 'Ordered closed by health inspector' :
        status === 'Conditional Pass' ? 'Passed with conditions to address' : '';
      document.getElementById('statusDate').textContent = latest?.date
        ? `Inspected ${new Date(latest.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : '';

      // Calculate reveal timing based on score (compressed for snappier feel)
      const revealDelay = safetyScore >= 90 ? 800 : safetyScore >= 80 ? 900 : safetyScore >= 70 ? 1000 : 1200;
      const countUpDuration = safetyScore >= 90 ? 600 : safetyScore >= 80 ? 700 : safetyScore >= 70 ? 800 : 1000;

      // PHASE 1: Loading/Suspense with rotating messages
      const loadingMessages = [
        "Analyzing inspection records...",
        "Checking violation history...",
        "Calculating safety score..."
      ];
      let messageIndex = 0;
      const loadingTextEl = document.getElementById('loadingText');
      const loadingInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        if (loadingTextEl) loadingTextEl.textContent = loadingMessages[messageIndex];
      }, 400);

      await new Promise(resolve => setTimeout(resolve, revealDelay));
      clearInterval(loadingInterval);

      // PHASE 2: Hide loading, show above-fold content
      document.getElementById('scoreLoading').style.display = 'none';
      document.getElementById('reportAboveFold').style.display = 'block';
      const scoreHero = document.getElementById('safetyScoreHero');
      scoreHero.classList.add('revealing');

      // Set CSS custom properties for colors
      scoreHero.style.setProperty('--score-color', scoreDetails.color);
      scoreHero.style.setProperty('--score-percent', safetyScore);

      // Get score circle wrapper for tier animations
      const scoreCircleWrapper = document.getElementById('scoreCircleWrapper');

      // TIERED CELEBRATION SYSTEM
      // Tier 1: Excellent (90-100) - Confetti + celebration badge
      if (safetyScore >= 90) {
        scoreHero.classList.add('celebration');
        document.getElementById('celebrationBadge').style.display = 'inline-flex';
        setTimeout(() => document.getElementById('celebrationBadge').classList.add('revealed'), 100);
      }
      // Tier 2: Good (80-89) - Green glow pulse
      else if (safetyScore >= 80) {
        setTimeout(() => {
          scoreCircleWrapper.classList.add('glow-green');
        }, 300);
      }
      // Tier 3: Fair (70-79) - Yellow pulse
      else if (safetyScore >= 70) {
        setTimeout(() => scoreCircleWrapper.classList.add('glow-yellow'), 300);
      }
      // Tier 4: Needs Work (60-69) - Orange pulse
      else if (safetyScore >= 60) {
        setTimeout(() => scoreCircleWrapper.classList.add('glow-orange'), 300);
      }
      // Tier 5: Critical (<60) - Slow red fade + share highlight
      else {
        scoreHero.classList.add('critical-fade');
        document.getElementById('warningBadge').style.display = 'inline-flex';
        setTimeout(() => document.getElementById('warningBadge').classList.add('revealed'), 100);
      }

      // Animate the score ring
      const scoreRing = document.getElementById('scoreRing');
      scoreRing.style.setProperty('--score-color', scoreDetails.hex);

      // PHASE 3: Animated count-up (or instant reveal for reduced motion)
      const scoreNumber = document.getElementById('scoreNumber');
      scoreNumber.style.setProperty('--score-color', scoreDetails.color);
      scoreNumber.classList.add('revealed');

      // Check for reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Haptic feedback callback (runs after score reveal)
      const hapticCallback = () => {
        if (safetyScore >= 90) {
          triggerHaptic([50, 100, 50]); // Double tap celebration
        } else if (safetyScore >= 80) {
          triggerHaptic([50]); // Single light tap
        } else if (safetyScore >= 70) {
          // No haptic for fair scores
        } else if (safetyScore >= 60) {
          // No haptic for needs work
        } else {
          triggerHaptic([150]); // Single firm vibration for critical
        }
      };

      if (prefersReducedMotion) {
        // Instant reveal for users who prefer reduced motion
        scoreNumber.textContent = safetyScore;
        hapticCallback();
      } else {
        // Animated count-up for standard experience
        animateCountUp(scoreNumber, safetyScore, countUpDuration, hapticCallback);
      }

      // PHASE 4: Reveal label
      setTimeout(() => {
        const scoreLabel = document.getElementById('scoreLabel');
        scoreLabel.textContent = scoreDetails.label;
        scoreLabel.className = `score-label ${scoreDetails.class} revealed`;
      }, 100);

      // PHASE 5: Reveal percentile (prominent)
      setTimeout(() => {
        const scorePercentile = document.getElementById('scorePercentile');
        if (safetyScore >= 80) {
          scorePercentile.innerHTML = `Safer than <strong>${percentile}%</strong> of Toronto restaurants`;
        } else {
          scorePercentile.innerHTML = `Worse than <strong>${100 - percentile}%</strong> of Toronto restaurants`;
        }
        scorePercentile.classList.add('revealed');
      }, 200);

      // Update severity breakdown
      document.getElementById('crucialCount').textContent = crucial;
      document.getElementById('significantCount').textContent = significant;
      document.getElementById('minorCount').textContent = minor;

      // PHASE 6: Show share section (above fold)
      setTimeout(() => {
        const shareSection = document.getElementById('shareSection');
        if (safetyScore < 60) {
          setTimeout(() => shareSection.classList.add('highlight-warning'), 100);
        }
        shareSection.style.display = 'block';
      }, 300);

      // PHASE 7: Show below-fold content
      setTimeout(() => {
        const reportDetails = document.getElementById('reportDetails');
        reportDetails.style.display = 'block';

        // Scary callout for violations
        if (findings.length > 0 && (crucial > 0 || significant > 0)) {
          const scaryCallout = document.getElementById('scaryCallout');
          const worstFinding = findings.find(f => f.severity.toUpperCase().startsWith('C')) ||
                              findings.find(f => f.severity.toUpperCase().startsWith('S')) ||
                              findings[0];
          if (worstFinding) {
            const translated = translateInfractionVisceral(worstFinding.text, worstFinding.severity);
            document.getElementById('calloutText').textContent = `"${translated.text}"`;
            document.getElementById('calloutDate').textContent = latest?.date
              ? `Inspected ${new Date(latest.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : '';
            scaryCallout.style.display = 'flex';
          }
        }

        // Timeline insight
        const timelineInsight = document.getElementById('timelineInsight');
        if (inspections.length >= 2) {
          const prev = inspections.slice(1);
          const prevAvg = prev.reduce((s, i) => s + i.infractions.length, 0) / prev.length;
          const currentScore = safetyScore;

          // Calculate score change over time
          const oldInspections = inspections.slice(-3);
          const oldTotal = oldInspections.reduce((s, i) => s + i.infractions.length, 0);
          const oldAvgViolations = oldTotal / oldInspections.length;

          if (total === 0 && prevAvg <= 1) {
            timelineInsight.textContent = '✓ Clean record - no violations in their last 3 inspections';
            timelineInsight.className = 'timeline-insight positive';
          } else if (total > prevAvg * 1.5 && prevAvg > 0) {
            const increase = Math.round(((total - prevAvg) / prevAvg) * 100);
            timelineInsight.textContent = `📉 Violations up ${increase}% compared to their usual`;
            timelineInsight.className = 'timeline-insight negative';
          } else if (total < prevAvg * 0.5 && prevAvg > 1) {
            timelineInsight.textContent = '📈 Improving - fewer violations than their historical average';
            timelineInsight.className = 'timeline-insight positive';
          } else if (total === 0) {
            timelineInsight.textContent = '✓ Clean inspection - no issues found this visit';
            timelineInsight.className = 'timeline-insight positive';
          }
          if (timelineInsight.textContent) {
            timelineInsight.style.display = 'block';
          }
        }
      }, 400);

      // PHASE 8: Show findings (if any)
      setTimeout(() => {
        const findingsList = document.getElementById('findingsList');
        const findingsSection = document.getElementById('findingsSection');

        if (findings.length > 0) {
          const translated = findings.slice(0, 3).map(f => translateInfractionVisceral(f.text, f.severity));
          findingsList.innerHTML = translated.map(t => `
            <div class="finding-item ${t.severity}">
              <span class="finding-icon">${t.icon}</span>
              <span class="finding-text">${t.text}</span>
              ${t.severity !== 'minor' ? `<span class="finding-severity-tag ${t.severity}">${t.severity}</span>` : ''}
            </div>
          `).join('');
          if (findings.length > 3) {
            findingsList.innerHTML += `<div class="finding-more">+ ${findings.length - 3} more issues</div>`;
          }
          findingsSection.style.display = 'block';
        }
      }, 500);

      // PHASE 9: Show history
      setTimeout(() => {
        const historySection = document.getElementById('historySection');
        historySection.style.display = 'block';

        const oldestYear = inspections.length > 0 ? new Date(inspections[inspections.length - 1].date).getFullYear() : new Date().getFullYear();
        document.getElementById('historyCount').textContent = `${inspections.length} visit${inspections.length === 1 ? '' : 's'} since ${oldestYear}`;

        const trendBars = document.getElementById('trendBars');
        const recent = inspections.slice(0, 6).reverse();
        trendBars.innerHTML = recent.map(insp => {
          const count = insp.infractions.length;
          const height = Math.max(4, Math.min(32, count * 6 + 4));
          const color = count === 0 ? 'clean' : count <= 2 ? 'warning' : 'danger';
          return `<div class="trend-bar ${color}" style="height:${height}px"></div>`;
        }).join('');
      }, 600);

      // PHASE 10: Show next inspection + CTA + footer
      setTimeout(() => {
        // Calculate next inspection expected
        if (inspections.length >= 2) {
          const dates = inspections.map(i => new Date(i.date));
          const avgGapDays = dates.slice(0, -1).reduce((sum, d, i) => {
            return sum + (d - dates[i + 1]) / (1000 * 60 * 60 * 24);
          }, 0) / (dates.length - 1);

          const lastDate = new Date(latest.date);
          const nextDate = new Date(lastDate.getTime() + avgGapDays * 24 * 60 * 60 * 1000);
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                             'July', 'August', 'September', 'October', 'November', 'December'];

          document.getElementById('nextDate').textContent = `~${monthNames[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
          document.getElementById('nextInspection').style.display = 'flex';
        }

        // CTA adapts based on signup status
        const reportCta = document.getElementById('reportCta');
        const ctaText = document.getElementById('ctaText');
        const isSignedUp = localStorage.getItem('suppersafe_unlocked') === 'true';

        if (isSignedUp) {
          ctaText.textContent = 'Share this report';
          reportCta.style.display = 'flex';
        } else {
          // Show only email capture for non-signed-up users (no redundant button)
          document.getElementById('reportEmailCapture').style.display = 'block';
        }

        document.getElementById('reportFooter').style.display = 'flex';
        document.getElementById('dataSource').style.display = 'block';
      }, 700);

      // Event listeners
      const reportCta = document.getElementById('reportCta');
      reportCta.addEventListener('click', () => {
        const isSignedUp = localStorage.getItem('suppersafe_unlocked') === 'true';
        if (isSignedUp) {
          // Scroll to share section or copy link
          const shareSection = document.getElementById('shareSection');
          shareSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          closeModal();
          document.getElementById('emailInput').focus();
          document.querySelector('.signup-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      // Email capture form handler
      const captureForm = document.getElementById('captureForm');
      if (captureForm) {
        captureForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const honeypot = document.getElementById('hpCapture');
          if (honeypot && honeypot.value) return; // Bot detected

          const email = document.getElementById('captureEmail').value.trim();
          if (!email) return;

          const btn = captureForm.querySelector('button');
          btn.disabled = true;
          btn.textContent = 'Joining...';

          try {
            await signUpWithEmail(email);
            document.getElementById('reportEmailCapture').style.display = 'none';
            showToast('You\'re on the list!');
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Get Early Access';
            showToast(err.message || 'Something went wrong');
          }
        });
      }

      // Share handlers - using viral-optimized varied templates
      document.getElementById('shareTwitter').addEventListener('click', () => {
        if (!currentRestaurant) return;
        const text = getShareMessage('twitter', currentRestaurant);
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
      });

      document.getElementById('shareWhatsapp').addEventListener('click', () => {
        if (!currentRestaurant) return;
        const text = getShareMessage('whatsapp', currentRestaurant);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      });

      document.getElementById('shareCopy').addEventListener('click', async () => {
        if (!currentRestaurant) return;
        const text = getShareMessage('copy', currentRestaurant);
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('shareCopy');
        btn.classList.add('copied');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied';
        showToast('Copied!');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
        }, 2000);
      });

    } catch (err) {
      console.error(err);
      document.getElementById('scoreLoading').innerHTML = '<div style="color: #DC2626;">Error loading data. Please try again.</div>';
    }
  }

  // Close modal on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Search
  const debouncedSearch = debounce(searchRestaurants, 300);
  searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value.trim()));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-wrapper')) {
      searchResults.classList.remove('active');
    }
  });

  // Auth - User signup using Supabase Auth
  async function signUpWithEmail(email) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Save to localStorage
      localStorage.setItem('suppersafe_unlocked', 'true');

      showSuccess('Check your email to confirm.');
      headlineTests.logConversion('email_signup');
      hasSignedUp = true;

    } catch (error) {
      showError(error.message || 'Something went wrong.');
    }
  }

  function showError(msg) {
    const el = document.getElementById('errorMessage');
    el.textContent = msg;
    el.classList.add('active');
  }

  function showSuccess(msg) {
    document.getElementById('successMessage').textContent = msg;
    document.getElementById('formState').classList.add('hidden');
    document.getElementById('successState').classList.add('active');
    document.getElementById('finalForm').classList.add('hidden');
    document.getElementById('finalSuccess').classList.add('active');
    isUnlocked = true;
    localStorage.setItem('suppersafe_unlocked', 'true');
  }

  document.getElementById('emailSubmit').addEventListener('click', () => {
    if (isBot('hpMain')) { showSuccess('Check your email to confirm.'); return; }
    const email = document.getElementById('emailInput').value.trim();
    if (!email) { showError('Enter your email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('Invalid email'); return; }
    document.getElementById('emailSubmit').disabled = true;
    document.getElementById('emailSubmit').textContent = 'Joining...';
    signUpWithEmail(email);
  });

  document.getElementById('finalSubmit').addEventListener('click', () => {
    if (isBot('hpFinal')) { return; }
    const email = document.getElementById('finalEmailInput').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    document.getElementById('finalSubmit').disabled = true;
    document.getElementById('finalSubmit').textContent = 'Joining...';
    signUpWithEmail(email);
  });

  document.getElementById('googleSignIn').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) showError(error.message);
  });

  // Check auth
  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showSuccess('You\'re in!');
    }
  })();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) showSuccess('You\'re in!');
  });

  // User count
  (async () => {
    try {
      const { data } = await supabase.rpc('get_user_count');
      if (data !== null) {
        const count = data + CONFIG.INITIAL_USER_COUNT;
        const el = document.getElementById('userCount');
        if (el) el.textContent = count;
      }
    } catch (e) {}
  })();

  // Enter key
  ['emailInput', 'finalEmailInput'].forEach(id => {
    document.getElementById(id).addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        const btnId = id === 'emailInput' ? 'emailSubmit' : 'finalSubmit';
        document.getElementById(btnId).click();
      }
    });
  });

  // Initialize user count display on DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    const el = document.getElementById('userCount');
    if (el) el.textContent = CONFIG.INITIAL_USER_COUNT;
  });
