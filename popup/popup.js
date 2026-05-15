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
const attackBonusInput = document.getElementById('attack-bonus');
const saveDcBonusInput = document.getElementById('save-dc-bonus');
const reportBugLink = document.getElementById('report-bug');
const viewSourceLink = document.getElementById('view-source');

/**
 * Check tab status by querying directly — no background service worker needed.
 * The popup has the 'tabs' permission, so it can call chrome.tabs.query itself.
 */
async function checkRoll20Status() {
  if (statusCheckInProgress) {
    log('Status check already in progress, skipping');
    return;
  }

  statusCheckInProgress = true;

  try {
    log('Checking status via tabs query...');
    const allTabs = await chrome.tabs.query({});
    const poke5eFound = allTabs.some(t => t.url && t.url.includes('poke5e.app'));
    const roll20Found = allTabs.some(t => t.url && (t.url.includes('roll20.net') || t.url.includes('app.roll20.net')));
    log('Status:', { poke5eFound, roll20Found });

    if (!extensionStatusEl || !roll20StatusEl) {
      log('ERROR: Status elements not found in DOM');
      return;
    }

    extensionStatusEl.textContent = poke5eFound ? '🟢 Connected' : '🔴 Not Found';
    extensionStatusEl.className = poke5eFound ? 'value enabled' : 'value disabled';
    roll20StatusEl.textContent = roll20Found ? '🟢 Connected' : '🔴 Not Found';
    roll20StatusEl.className = roll20Found ? 'value enabled' : 'value disabled';
  } catch (error) {
    log('Error checking status:', error);
    if (extensionStatusEl) { extensionStatusEl.textContent = '❌ Error'; extensionStatusEl.className = 'value disabled'; }
    if (roll20StatusEl) { roll20StatusEl.textContent = '❌ Error'; roll20StatusEl.className = 'value disabled'; }
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
  
  // Load bonus values
  const attackBonus = await StorageManager.getSetting('attackBonus', 0);
  const saveDcBonus = await StorageManager.getSetting('saveDcBonus', 0);
  
  if (attackBonusInput) attackBonusInput.value = attackBonus;
  if (saveDcBonusInput) saveDcBonusInput.value = saveDcBonus;
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  await StorageManager.setSetting('extensionEnabled', enableExtensionCheckbox.checked);

  showFeedback('Settings saved!');
}

/**
 * Save bonus values to storage
 */
async function saveBonuses() {
  const attackBonus = parseInt(attackBonusInput.value) || 0;
  const saveDcBonus = parseInt(saveDcBonusInput.value) || 0;
  
  await StorageManager.setSetting('attackBonus', attackBonus);
  await StorageManager.setSetting('saveDcBonus', saveDcBonus);

  showFeedback('Bonus saved!');
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

if (attackBonusInput) {
  attackBonusInput.addEventListener('change', saveBonuses);
}

if (saveDcBonusInput) {
  saveDcBonusInput.addEventListener('change', saveBonuses);
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
