/**
 * Background Service Worker
 * Handles communication between Pokemon 5e and Roll20 tabs
 */

// Import logger utilities
importScripts('utils/logger.js');

/**
 * Find an active Roll20 tab
 * @returns {Promise<Object|null>} Tab object or null if not found
 */
async function findRoll20Tab() {
  try {
    log('Querying for Roll20 tabs...');
    
    // Query for tabs matching Roll20 URLs
    const tabs = await chrome.tabs.query({
      url: ['*://roll20.net/*', '*://app.roll20.net/*']
    });
    
    log('Tab query returned:', tabs.length, 'tabs');
    
    if (tabs && tabs.length > 0) {
      const roll20Tab = tabs[0];
      log('Found Roll20 tab:', roll20Tab.id, 'URL:', roll20Tab.url);
      return roll20Tab;
    }
    
    // Fallback: query all tabs and filter manually
    log('No tabs found with URL filter, trying manual filter...');
    const allTabs = await chrome.tabs.query({});
    log('Total tabs found:', allTabs.length);
    
    const roll20Tab = allTabs.find(tab => {
      const hasUrl = tab.url && typeof tab.url === 'string';
      const isRoll20 = hasUrl && (
        tab.url.includes('roll20.net') || 
        tab.url.includes('app.roll20.net')
      );
      if (hasUrl) {
        log('Tab:', tab.id, 'URL:', tab.url, 'isRoll20:', isRoll20);
      }
      return isRoll20;
    });
    
    if (roll20Tab) {
      log('Found Roll20 tab via manual filter:', roll20Tab.id);
    } else {
      log('No Roll20 tab found');
    }
    
    return roll20Tab || null;
  } catch (error) {
    log('Error finding Roll20 tab:', error.message);
    return null;
  }
}

/**
 * Find an active Poke5e.app tab
 * @returns {Promise<Object|null>} Tab object or null if not found
 */
async function findPoke5eTab() {
  try {
    log('Querying for Poke5e tabs...');
    
    // Query for tabs matching Poke5e URLs
    const tabs = await chrome.tabs.query({
      url: ['*://poke5e.app/*', '*://www.poke5e.app/*']
    });
    
    log('Poke5e tab query returned:', tabs.length, 'tabs');
    
    if (tabs && tabs.length > 0) {
      const poke5eTab = tabs[0];
      log('Found Poke5e tab:', poke5eTab.id, 'URL:', poke5eTab.url);
      return poke5eTab;
    }
    
    // Fallback: query all tabs and filter manually
    log('No Poke5e tabs found with URL filter, trying manual filter...');
    const allTabs = await chrome.tabs.query({});
    
    const poke5eTab = allTabs.find(tab => {
      const hasUrl = tab.url && typeof tab.url === 'string';
      const isPoke5e = hasUrl && (
        tab.url.includes('poke5e.app')
      );
      return isPoke5e;
    });
    
    if (poke5eTab) {
      log('Found Poke5e tab via manual filter:', poke5eTab.id);
    } else {
      log('No Poke5e tab found');
    }
    
    return poke5eTab || null;
  } catch (error) {
    log('Error finding Poke5e tab:', error.message);
    return null;
  }
}

/**
 * Send a roll request to Roll20
 * @param {Object} rollData - The roll request data
 */
async function sendRollToRoll20(rollData) {
  log('sendRollToRoll20 called with:', rollData);
  
  const roll20Tab = await findRoll20Tab();
  
  if (!roll20Tab) {
    log('❌ ERROR: No Roll20 tab found');
    return {
      success: false,
      error: 'No active Roll20 tab found. Please open Roll20 first.'
    };
  }

  try {
    log('Attempting to send message to Roll20 tab:', roll20Tab.id);
    
    const response = await chrome.tabs.sendMessage(roll20Tab.id, {
      type: 'EXECUTE_ROLL',
      data: rollData
    });
    
    log('✓ Roll20 response received:', response);
    return response || { success: true, message: 'Roll sent' };
    
  } catch (error) {
    log('❌ Error sending roll to Roll20:', error.message);
    return {
      success: false,
      error: `Failed to send roll to Roll20: ${error.message}`
    };
  }
}

/**
 * Main message listener
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Log with safe sender access
  const tabId = sender?.tab?.id || 'unknown';
  log('Message received:', request.type, 'from tab:', tabId);

  // Handle roll requests from poke5e.app
  if (request.type === 'ROLL_REQUEST') {
    log('Processing roll request:', request);
    (async () => {
      try {
        const response = await sendRollToRoll20(request.data);
        sendResponse(response);
      } catch (error) {
        log('Error in roll request handler:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle attack requests (hit roll + damage roll) from poke5e.app
  if (request.type === 'ATTACK_REQUEST') {
    log('Processing attack request:', request);
    (async () => {
      try {
        const roll20Tab = await findRoll20Tab();
        if (!roll20Tab) {
          sendResponse({ success: false, error: 'No active Roll20 tab found.' });
          return;
        }
        const response = await chrome.tabs.sendMessage(roll20Tab.id, {
          type: 'EXECUTE_ATTACK',
          data: request.data
        });
        sendResponse(response || { success: true });
      } catch (error) {
        log('Error in attack request handler:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle status check
  if (request.type === 'CHECK_STATUS') {
    log('Processing status check...');
    (async () => {
      try {
        const roll20Tab = await findRoll20Tab();
        const poke5eTab = await findPoke5eTab();
        const response = {
          poke5eFound: !!poke5eTab,
          roll20Found: !!roll20Tab
        };
        log('Status check response:', response);
        sendResponse(response);
      } catch (error) {
        log('Error in status check handler:', error);
        sendResponse({
          poke5eFound: false,
          roll20Found: false,
          error: error.message
        });
      }
    })();
    return true;
  }

  // Handle debug requests
  if (request.type === 'DEBUG_LOG') {
    log('DEBUG from content:', request.message);
    sendResponse({ received: true });
    return true;
  }

  // Handle debug tab query
  if (request.type === 'DEBUG_QUERY_TABS') {
    log('Processing debug tab query...');
    (async () => {
      try {
        const tabs = await chrome.tabs.query({});
        const tabInfo = tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          active: tab.active
        }));
        log('Tab query debug:', tabInfo);
        const response = {
          tabs: tabInfo,
          roll20Found: tabs.some(t => t.url && (t.url.includes('roll20.net') || t.url.includes('app.roll20.net')))
        };
        sendResponse(response);
      } catch (error) {
        log('Error in debug query handler:', error);
        sendResponse({
          tabs: [],
          roll20Found: false,
          error: error.message
        });
      }
    })();
    return true;
  }

  // Handle get bonuses request
  if (request.type === 'GET_BONUSES') {
    log('Processing get bonuses request...');
    (async () => {
      try {
        // Import storage to get bonuses
        const attackBonus = await new Promise((resolve) => {
          chrome.storage.sync.get(['attackBonus'], (result) => {
            resolve(result.attackBonus || 0);
          });
        });
        
        const saveDcBonus = await new Promise((resolve) => {
          chrome.storage.sync.get(['saveDcBonus'], (result) => {
            resolve(result.saveDcBonus || 0);
          });
        });
        
        const response = {
          attackBonus: parseInt(attackBonus),
          saveDcBonus: parseInt(saveDcBonus)
        };
        log('Get bonuses response:', response);
        sendResponse(response);
      } catch (error) {
        log('Error in get bonuses handler:', error);
        sendResponse({
          attackBonus: 0,
          saveDcBonus: 0,
          error: error.message
        });
      }
    })();
    return true;
  }

  // Unknown request type
  log('Unknown request type:', request.type);
  sendResponse({ error: 'Unknown request type' });
  return true;
});

log('Background service worker loaded and ready');
