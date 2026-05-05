/**
 * Popup Script
 * Handles the extension popup UI interactions
 */

log('Initialized');

// DOM Elements
const extensionStatusEl = document.getElementById('extension-status');
const roll20StatusEl = document.getElementById('roll20-status');
const enableExtensionCheckbox = document.getElementById('enable-extension');
const soundEnabledCheckbox = document.getElementById('sound-enabled');
const notificationStyleSelect = document.getElementById('notification-style');
const testConnectionBtn = document.getElementById('test-connection');
const viewHistoryBtn = document.getElementById('view-history');
const resetSettingsBtn = document.getElementById('reset-settings');
const reportBugLink = document.getElementById('report-bug');
const viewSourceLink = document.getElementById('view-source');

/**
 * Check Roll20 tab status
 */
async function checkRoll20Status() {
  try {
    log('Checking Roll20 status...');
    
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Status check timeout'));
      }, 5000);
      
      chrome.runtime.sendMessage(
        { type: 'CHECK_STATUS' },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });

    log('Status response:', response);

    // Update extension status
    if (response || response.extensionActive) {
      extensionStatusEl.textContent = '🟢 Active';
      extensionStatusEl.className = 'value enabled';
    } else {
      extensionStatusEl.textContent = '🔴 Inactive';
      extensionStatusEl.className = 'value disabled';
    }

    // Update Roll20 status
    if (response || response.roll20Found) {
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
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const settings = await StorageManager.getAllSettings();

  enableExtensionCheckbox.checked = settings.extensionEnabled;
  soundEnabledCheckbox.checked = settings.soundEnabled;
  notificationStyleSelect.value = settings.notificationStyle;
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  await StorageManager.setSetting('extensionEnabled', enableExtensionCheckbox.checked);
  await StorageManager.setSetting('soundEnabled', soundEnabledCheckbox.checked);
  await StorageManager.setSetting('notificationStyle', notificationStyleSelect.value);

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
 * Test connection between poke5e and Roll20
 */
async function testConnection() {
  testConnectionBtn.textContent = 'Testing...';
  testConnectionBtn.disabled = true;

  try {
    log('Starting connection test...');
    
    // Send test message to background
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Background worker not responding'));
      }, 5000);
      
      chrome.runtime.sendMessage(
        { type: 'CHECK_STATUS' },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });

    log('Connection test response:', response);

    if (response || response.roll20Found) {
      showFeedback('✓ Connection successful! Roll20 detected.');
      testConnectionBtn.textContent = 'Connection OK';
      testConnectionBtn.style.background = '#4CAF50';
      testConnectionBtn.style.color = 'white';
    } else {
      showFeedback('✗ No Roll20 tab found. Please open Roll20 first.');
      log('Roll20 not found. Make sure Roll20 is open.');
    }
  } catch (error) {
    log('Connection test failed:', error);
    showFeedback(`✗ Connection failed: ${error.message}`);
  } finally {
    setTimeout(() => {
      testConnectionBtn.textContent = 'Test Connection';
      testConnectionBtn.disabled = false;
      testConnectionBtn.style.background = '';
      testConnectionBtn.style.color = '';
    }, 2000);
  }
}

/**
 * View roll history
 */
async function viewRollHistory() {
  const history = await StorageManager.getRollHistory(10);

  if (history.length === 0) {
    alert('No roll history yet. Make some rolls in Roll20!');
    return;
  }

  let historyText = 'Recent Rolls:\n\n';
  history.forEach((roll, index) => {
    const date = new Date(roll.timestamp);
    historyText += `${index + 1}. [${date.toLocaleTimeString()}] ${roll.label || 'Unknown'}\n`;
    historyText += `   Formula: ${roll.diceFormula}\n\n`;
  });

  alert(historyText);
}

/**
 * Reset all settings
 */
async function resetAllSettings() {
  if (!confirm('Are you sure? This will reset all settings to defaults.')) {
    return;
  }

  await StorageManager.resetSettings();
  await StorageManager.clearRollHistory();

  // Reload settings
  await loadSettings();

  showFeedback('Settings reset to defaults');
}

/**
 * Event listeners
 */
enableExtensionCheckbox.addEventListener('change', saveSettings);
soundEnabledCheckbox.addEventListener('change', saveSettings);
notificationStyleSelect.addEventListener('change', saveSettings);

testConnectionBtn.addEventListener('click', testConnection);
viewHistoryBtn.addEventListener('click', viewRollHistory);
resetSettingsBtn.addEventListener('click', resetAllSettings);

reportBugLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({
    url: 'https://github.com/yourusername/pkm5e-extension/issues'
  });
});

viewSourceLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({
    url: 'https://github.com/yourusername/pkm5e-extension'
  });
});

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
