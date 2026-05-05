/**
 * Storage Module
 * Manages extension settings and data persistence
 */

const StorageManager = (() => {
  // Default settings
  const DEFAULT_SETTINGS = {
    extensionEnabled: true,
    notificationStyle: 'toast', // toast, badge, console
    enableDebug: false,
    rollNotationStyle: 'verbose', // verbose, concise
    soundEnabled: false
  };

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @param {*} defaultValue - Default if not found
   * @returns {Promise<*>} Setting value
   */
  function getSetting(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError);
          resolve(defaultValue ?? DEFAULT_SETTINGS[key]);
        } else {
          resolve(result[key] ?? defaultValue ?? DEFAULT_SETTINGS[key]);
        }
      });
    });
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {*} value - Value to set
   * @returns {Promise<boolean>} Success status
   */
  function setSetting(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Get all settings
   * @returns {Promise<Object>} All settings
   */
  function getAllSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (result) => {
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError);
          resolve(DEFAULT_SETTINGS);
        } else {
          resolve({ ...DEFAULT_SETTINGS, ...result });
        }
      });
    });
  }

  /**
   * Clear all settings and reset to defaults
   * @returns {Promise<boolean>} Success status
   */
  function resetSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.clear(() => {
        if (chrome.runtime.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Add a roll to history
   * @param {Object} rollData - Data from the roll
   * @returns {Promise<boolean>} Success status
   */
  function addToRollHistory(rollData) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['rollHistory'], (result) => {
        const history = result.rollHistory || [];
        history.push({
          ...rollData,
          timestamp: Date.now()
        });

        // Keep only last 100 rolls
        if (history.length > 100) {
          history.shift();
        }

        chrome.storage.local.set({ rollHistory: history }, () => {
          resolve(!chrome.runtime.lastError);
        });
      });
    });
  }

  /**
   * Get roll history
   * @param {number} limit - Max number of rolls to retrieve
   * @returns {Promise<Array>} Roll history
   */
  function getRollHistory(limit = 20) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['rollHistory'], (result) => {
        const history = result.rollHistory || [];
        resolve(history.slice(-limit).reverse());
      });
    });
  }

  /**
   * Clear roll history
   * @returns {Promise<boolean>} Success status
   */
  function clearRollHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['rollHistory'], () => {
        resolve(!chrome.runtime.lastError);
      });
    });
  }

  // Public API
  return {
    getSetting,
    setSetting,
    getAllSettings,
    resetSettings,
    addToRollHistory,
    getRollHistory,
    clearRollHistory,
    DEFAULT_SETTINGS
  };
})();
