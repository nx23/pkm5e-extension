/**
 * Pokemon 5e Content Script
 * Runs on poke5e.app to enable roll integration
 */

log('Content script loaded on poke5e.app');

// Inject dice icon URLs into CSS. The base d20.png is always applied.
// Holding Shift swaps to d20-adv.png (advantage) and Ctrl to d20-dadv.png (disadvantage)
// via classes added to <body> by the keyboard listeners below.
(function injectDiceIconStyle() {
  const d20    = chrome.runtime.getURL('assets/d20.png');
  const d20Adv = chrome.runtime.getURL('assets/d20-adv.png');
  const d20Dis = chrome.runtime.getURL('assets/d20-dadv.png');

  const style = document.createElement('style');
  style.textContent = [
    `.poke5e-hover::before { background-image: url("${d20}"); }`,
    `body.poke5e-advantage  .poke5e-hover::before { background-image: url("${d20Adv}"); }`,
    `body.poke5e-disadvantage .poke5e-hover::before { background-image: url("${d20Dis}"); }`,
  ].join('\n');
  document.head.appendChild(style);
})();

// Listen for Shift / Ctrl to update the dice icon on all rollable elements.
(function setupDiceIconKeyListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      document.body.classList.add('poke5e-advantage');
      document.body.classList.remove('poke5e-disadvantage');
    } else if (e.key === 'Control') {
      document.body.classList.add('poke5e-disadvantage');
      document.body.classList.remove('poke5e-advantage');
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
      document.body.classList.remove('poke5e-advantage');
    } else if (e.key === 'Control') {
      document.body.classList.remove('poke5e-disadvantage');
    }
  });

  // Clear both states if the window loses focus (e.g. Alt+Tab while holding a key)
  window.addEventListener('blur', () => {
    document.body.classList.remove('poke5e-advantage', 'poke5e-disadvantage');
  });
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
          console.warn('Background worker error:', chrome.runtime.lastError.message);
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
