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

  // Wait for page to fully load with retry logic
  let retries = 0;
  const maxRetries = 10; // Try up to 10 times
  const retryDelay = 1000; // Wait 1 second between retries

  function attemptInitialization() {
    retries++;
    log(`Initialization attempt ${retries}/${maxRetries}...`);
    
    // DEBUG: Log page structure to understand why parsing is failing
    if (typeof DataParser !== 'undefined' && DataParser.debugPageStructure) {
      log('=== DEBUGGING PAGE STRUCTURE ===');
      const debug = DataParser.debugPageStructure();
      log('Detected:', debug.pageType);
      
      // Check if this is a valid character page
      if (!debug.isTrainerPage && !debug.isPokemonPage) {
        log('⚠️ Página ainda não carregou completamente...');
        log('bodyTextLength:', debug.bodyTextLength);
        
        // Retry if page hasn't loaded yet
        if (retries < maxRetries && debug.bodyTextLength < 500) {
          log(`Tentando novamente em ${retryDelay}ms...`);
          setTimeout(attemptInitialization, retryDelay);
          return;
        }
        
        if (retries >= maxRetries) {
          log('❌ Excedido número máximo de tentativas');
          return;
        }
      }
    }
    
    try {
      log('✓ Página carregou! Inicializando handlers...');
      
      // Inject click handlers
      ClickInjector.injectAllHandlers();
      
      // Log initial sheet data
      const sheetData = DataParser.getCompleteSheetData();
      log('Sheet detected:', sheetData);
      log('=== EXTRACTED DATA ===');
      log('Abilities found:', Object.keys(sheetData.abilities).length);
      log('Saves found:', Object.keys(sheetData.saves).length);
      log('Skills found:', Object.keys(sheetData.skills).length);
      log('Full data:', sheetData);
    } catch (error) {
      log('Error during initialization:', error);
    }
  }

  // Start initialization after 1 second (let React/Vue finish initial render)
  setTimeout(attemptInitialization, 1000);
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
        ClickInjector.reinjectHandlers();
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
