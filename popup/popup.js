/**
 * Popup Script
 * Handles the extension popup UI interactions
 */

log('Initialized');

// Track if a status check is in progress
let statusCheckInProgress = false;

// DOM Elements
const extensionStatusEl = document.getElementById('poke5e-status');
const roll20StatusEl = document.getElementById('roll20-status');
const enableExtensionCheckbox = document.getElementById('enable-extension');
const reportBugLink = document.getElementById('report-bug');
const viewSourceLink = document.getElementById('view-source');

/**
 * Check Roll20 tab status
 */
async function checkRoll20Status() {
  // Prevent concurrent checks
  if (statusCheckInProgress) {
    log('Status check already in progress, skipping');
    return;
  }
  
  statusCheckInProgress = true;
  
  try {
    log('Checking Roll20 status...');
    
    const response = await new Promise((resolve, reject) => {
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          log('Status check timeout - using default response');
          resolve({ poke5eFound: false, roll20Found: false });
        }
      }, 3000);
      
      chrome.runtime.sendMessage(
        { type: 'CHECK_STATUS' },
        (response) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            log('Raw callback response:', response, 'lastError:', chrome.runtime.lastError);
            if (chrome.runtime.lastError) {
              log('Chrome runtime error:', chrome.runtime.lastError);
              resolve({ poke5eFound: false, roll20Found: false });
            } else if (response === undefined) {
              log('Response is undefined, using default');
              resolve({ poke5eFound: false, roll20Found: false });
            } else {
              resolve(response);
            }
          }
        }
      );
    });

    log('Status response:', response);
    
    // Ensure we have elements before updating
    if (!extensionStatusEl || !roll20StatusEl) {
      log('ERROR: Status elements not found in DOM');
      return;
    }

    // Update poke5e status
    if (response && response.poke5eFound) {
      extensionStatusEl.textContent = '🟢 Connected';
      extensionStatusEl.className = 'value enabled';
    } else {
      extensionStatusEl.textContent = '🔴 Not Found';
      extensionStatusEl.className = 'value disabled';
    }

    // Update Roll20 status
    if (response && response.roll20Found) {
      roll20StatusEl.textContent = '🟢 Connected';
      roll20StatusEl.className = 'value enabled';
    } else {
      roll20StatusEl.textContent = '🔴 Not Found';
      roll20StatusEl.className = 'value disabled';
    }
  } catch (error) {
    log('Error checking status:', error);
    extensionStatusEl.textContent = '❌ Error';
    extensionStatusEl.className = 'value disabled';
    roll20StatusEl.textContent = '❌ Error';
    roll20StatusEl.className = 'value disabled';
  } finally {
    statusCheckInProgress = false;
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const settings = await StorageManager.getAllSettings();

  enableExtensionCheckbox.checked = settings.extensionEnabled;
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  await StorageManager.setSetting('extensionEnabled', enableExtensionCheckbox.checked);

  showFeedback('Settings saved!');
}

/**
 * Show temporary feedback message
 */
function showFeedback(message) {
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: #4CAF50;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  feedback.textContent = message;
  document.body.appendChild(feedback);

  setTimeout(() => {
    feedback.remove();
  }, 2000);
}

/**
 * Reset all settings
 */
async function resetAllSettings() {
  if (!confirm('Are you sure? This will reset all settings to defaults.')) {
    return;
  }

  await StorageManager.resetSettings();

  // Reload settings
  await loadSettings();

  showFeedback('Settings reset to defaults');
}

/**
 * Event listeners
 */
if (enableExtensionCheckbox) {
  enableExtensionCheckbox.addEventListener('change', saveSettings);
}

if (reportBugLink) {
  reportBugLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/nx23/pkm5e-extension/issues'
    });
  });
}

if (viewSourceLink) {
  viewSourceLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/nx23/pkm5e-extension'
    });
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  log('DOM loaded, initializing...');
  
  try {
    await loadSettings();
    log('Settings loaded');
  } catch (error) {
    log('Error loading settings:', error);
  }
  
  try {
    await checkRoll20Status();
    log('Roll20 status checked');
  } catch (error) {
    log('Error checking Roll20 status:', error);
  }

  // Refresh status every 3 seconds
  setInterval(checkRoll20Status, 3000);
  
  log('Initialization complete');
});

log('Ready! Debug helpers available in window.__poke5ePopupDebug');
