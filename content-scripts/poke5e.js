/**
 * Pokemon 5e Content Script
 * Runs on poke5e.app to enable roll integration
 */

log('Content script loaded on poke5e.app');

// Inject dice icon URL into CSS for .poke5e-hover::after
(function injectDiceIconStyle() {
  const iconUrl = chrome.runtime.getURL('assets/d20.png');
  const style = document.createElement('style');
  style.textContent = `.poke5e-hover::before { background-image: url("${iconUrl}"); }`;
  document.head.appendChild(style);
})();

log('Available modules:', {
  hasDataParser: typeof DataParser !== 'undefined',
  hasClickInjector: typeof ClickInjector !== 'undefined',
  hasStorageManager: typeof StorageManager !== 'undefined'
});

// Verify modules are available
if (typeof DataParser === 'undefined') {
  log('ERROR: DataParser not defined!');
}
if (typeof ClickInjector === 'undefined') {
  log('ERROR: ClickInjector not defined!');
}
if (typeof StorageManager === 'undefined') {
  log('ERROR: StorageManager not defined!');
}

// Initialize the extension on poke5e.app
// Attempt to inject handlers with retry logic (used both on first load and after SPA navigation)
let navigationRetryTimeout = null;

function attemptInitialization(retries = 0) {
  const maxRetries = 10;
  const retryDelay = 1000;
  retries++;
  log(`Initialization attempt ${retries}/${maxRetries}...`);

  const debug = DataParser.debugPageStructure();

  const pageReady = debug.indicators.hasAbilityScores ||
                    debug.indicators.hasSavesSection ||
                    debug.indicators.hasSkillsSection;

  if (!pageReady) {
    if (retries < maxRetries) {
      navigationRetryTimeout = setTimeout(() => attemptInitialization(retries), retryDelay);
      return;
    }
    log('❌ Excedido número máximo de tentativas');
    return;
  }

  try {
    log('✓ Página carregou! Inicializando handlers...');
    ClickInjector.injectAllHandlers();

    const sheetData = DataParser.getCompleteSheetData();
    log('Abilities found:', Object.keys(sheetData.abilities).length);
    log('Saves found:', Object.keys(sheetData.saves).length);
    log('Skills found:', Object.keys(sheetData.skills).length);
  } catch (error) {
    log('Error during initialization:', error);
  }
}

// Detect SPA navigation by polling location.href
// (history.pushState patching doesn't work from isolated worlds in Chrome extensions)
function setupNavigationDetection() {
  let lastUrl = location.href;

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      log('URL changed to', lastUrl, '— reinitializing...');
      clearTimeout(navigationRetryTimeout);
      // Give SvelteKit ~800ms to swap the DOM before starting retries
      navigationRetryTimeout = setTimeout(() => attemptInitialization(0), 800);
    }
  }, 500);

  log('Navigation detection active (URL polling)');
}

async function initializeExtension() {
  // Check if extension is enabled
  try {
    const isEnabled = await StorageManager.getSetting('extensionEnabled', true);
    if (!isEnabled) {
      log('Extension disabled in settings');
      return;
    }
  } catch (error) {
    log('Error checking settings:', error);
  }

  setupNavigationDetection();

  // Start initialization after 1 second (let SvelteKit finish initial render)
  setTimeout(() => attemptInitialization(0), 1000);
}

// Check status with background worker
function checkBackgroundStatus() {
  try {
    // Verify extension context is valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn('Chrome extension context not available yet');
      return;
    }
    
    chrome.runtime.sendMessage(
      { type: 'CHECK_STATUS' },
      response => {
        if (chrome.runtime.lastError) {
          // Silently ignore "no receiver" errors — the service worker may be asleep
          if (!chrome.runtime.lastError.message.includes('Could not establish connection')) {
            console.warn('Background worker error:', chrome.runtime.lastError.message);
          }
          return;
        }
        if (response && response.roll20Found) {
          log('✓ Roll20 tab detected');
        } else {
          console.warn('⚠ No Roll20 tab found - please open Roll20');
        }
      }
    );
  } catch (error) {
    log('Error checking background status:', error.message);
  }
}

// Set up mutation observer to handle dynamic content
let mutationObserverInstance = null;

function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Desconectar o observer para evitar capturar eventos durante reinjeção
    observer.disconnect();
    
    // Debounce reinjection
    clearTimeout(setupMutationObserver.timeout);
    setupMutationObserver.timeout = setTimeout(() => {
      log('Sheet updated, reinjecting handlers...');
      
      try {
        ClickInjector.reinjectHandlers();
      } catch (error) {
        log('Error reinjecting handlers:', error);
      } finally {
        // Reconectar o observer após reinjetar
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: false,
          attributes: false
        });
      }
    }, 500); // Reduzir debounce de 1000 para 500ms
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false,
    attributes: false
  });

  mutationObserverInstance = observer;
  log('Mutation observer activated');
}

// Função para parar o observer se necessário
function stopMutationObserver() {
  if (mutationObserverInstance) {
    mutationObserverInstance.disconnect();
    log('Mutation observer stopped');
  }
}

// Handle visibility changes (when user switches tabs)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    log('Page became visible, checking status...');
    checkBackgroundStatus();
  }
});

// Expose utilities to page for debugging - with verification
function setupDebugInterface() {
  const debugInterface = {
    DataParser: typeof DataParser !== 'undefined' ? DataParser : null,
    ClickInjector: typeof ClickInjector !== 'undefined' ? ClickInjector : null,
    StorageManager: typeof StorageManager !== 'undefined' ? StorageManager : null,
    checkStatus: () => {
      log('Manual status check requested');
      checkBackgroundStatus();
    },
    reinject: () => {
      if (ClickInjector) {
        attemptInitialization(0);
      } else {
        log('ClickInjector not available');
      }
    },
    getData: () => {
      if (DataParser) {
        return DataParser.getCompleteSheetData();
      } else {
        log('DataParser not available');
        return null;
      }
    },
    debugPageStructure: () => {
      if (DataParser) {
        return DataParser.debugPageStructure();
      } else {
        log('DataParser not available');
        return null;
      }
    },
    sendRollRequest: (context) => {
      if (ClickInjector) {
        log('Manual roll request:', context);
        ClickInjector.sendRollRequest(context);
      } else {
        log('ClickInjector not available');
      }
    },
    stopObserver: () => {
      stopMutationObserver();
    },
    startObserver: () => {
      setupMutationObserver();
    },
    log: log.bind(console, '[PKM5e Roll20 Extension]'),
    status: () => ({
      dataParserAvailable: typeof DataParser !== 'undefined',
      clickInjectorAvailable: typeof ClickInjector !== 'undefined',
      storageManagerAvailable: typeof StorageManager !== 'undefined',
      extensionContextAvailable: !!chrome?.runtime?.sendMessage
    })
  };
  
  return debugInterface;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

// Setup debug interface immediately
setupDebugInterface();

// Delay status checks to allow background worker to initialize
log('Scheduling status checks after delay...');
setTimeout(() => {
  log('First status check...');
  checkBackgroundStatus();
  
  // Then check periodically
  setInterval(checkBackgroundStatus, 5000);
}, 2000);
