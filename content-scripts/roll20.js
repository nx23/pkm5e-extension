/**
 * Roll20 Content Script
 * Runs on roll20.net to receive and execute roll commands
 */

log('Content script loaded on Roll20');

const Roll20Integration = (() => {
  /**
   * Find the chat input element
   * Tries multiple selectors for different Roll20 versions
   * @returns {HTMLElement|null} Chat input element
   */
  function findChatInput() {
    log('Searching for chat input element...');

    // Try multiple selectors for different Roll20 versions
    const selectors = [
      '#textchat-input > textarea',
      '#chat-input',
      'textarea[placeholder*="Type"]',
      'textarea[id*="chat"]',
      'textarea[id*="input"]',
      'textarea:not([readonly])'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetHeight > 0) {  // Make sure it's visible
        log('Found chat input with selector:', selector);
        return element;
      }
    }

    log('⚠️ Chat input not found with any selector');
    log('Available textareas:', document.querySelectorAll('textarea').length);
    
    // Fallback: return first visible textarea
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (ta.offsetHeight > 0 && !ta.readOnly) {
        log('Using fallback textarea');
        return ta;
      }
    }

    log('❌ No chat input found');
    return null;
  }

  /**
   * Generate a dice formula from roll data
   * @param {Object} rollData - Roll context
   * @returns {string} Dice formula
   */
  function generateDiceFormula(rollData) {
    const { modifier, stat, rollType, label } = rollData;

    // Basic Roll20 format: /roll 1d20+modifier
    // Handle positive, zero, and negative modifiers correctly
    const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    let formula = `1d20${modifierStr}`;

    // Add descriptive label
    formula += ` [${label || `${stat} ${rollType}`}]`;

    return formula;
  }

  /**
   * Inject roll into chat
   * @param {Object} rollData - Roll context
   * @returns {boolean} Success status
   */
  function injectRollIntoChat(rollData) {
    log('Starting roll injection with data:', rollData);
    
    const chatInput = findChatInput();

    if (!chatInput) {
      log('❌ ERROR: Could not find chat input element');
      showNotification('❌ Could not find Roll20 chat input', 'error');
      return false;
    }

    try {
      // Validate roll data
      if (!rollData || !rollData.stat) {
        log('⚠️ Invalid roll data:', rollData);
        showNotification('Invalid roll data', 'error');
        return false;
      }

      // Generate the command
      const formula = generateDiceFormula(rollData);
      const command = `/roll ${formula}`;

      log('Generated command:', command);
      log('Injecting into chat input...');

      // Set the value
      chatInput.value = command;
      log('✓ Value set to:', chatInput.value);

      // Trigger input event (for reactive frameworks)
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      chatInput.dispatchEvent(new Event('change', { bubbles: true }));
      log('✓ Events dispatched');

      // Optional: Auto-submit if user enables it
      // Uncomment to auto-send:
      const sendButton = document.querySelector('#chatSendBtn');
      if (sendButton) {
        sendButton.click();
      }

      log('✓ Roll injected successfully:', command);
      showNotification('✓ Roll injected into Roll20 chat', 'success');
      return true;

    } catch (error) {
      log('✗ Error injecting roll:', error.message);
      log('Full error:', error);
      showNotification(`✗ Error: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Show notification
   * @param {string} message - Message to display
   * @param {string} type - 'success', 'error', 'info'
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `poke5e-notification poke5e-notification-${type}`;
    notification.innerText = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      ${type === 'success' ? 'background: #4CAF50; color: white;' : ''}
      ${type === 'error' ? 'background: #f44336; color: white;' : ''}
      ${type === 'info' ? 'background: #2196F3; color: white;' : ''}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Message listener for roll requests
   */
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      log('Roll20 message listener received:', request.type);
      log('From:', sender.origin || sender.url);

      if (request.type === 'EXECUTE_ROLL') {
        log('Processing EXECUTE_ROLL request...');
        try {
          const success = injectRollIntoChat(request.data);
          
          const response = {
            success: success,
            message: success ? '✓ Roll injected' : '✗ Failed to inject roll',
            data: request.data
          };
          
          log('Sending response:', response);
          sendResponse(response);
        } catch (error) {
          log('❌ Error processing roll:', error.message);
          sendResponse({
            success: false,
            message: `Error: ${error.message}`,
            data: request.data
          });
        }

        return true;
      }

      log('Unknown message type:', request.type);
    });

    log('✓ Roll20 message listener activated');
  }

  // Public API
  return {
    setupMessageListener,
    injectRollIntoChat,
    generateDiceFormula,
    findChatInput,
    showNotification
  };
})();

// Initialize on page load
Roll20Integration.setupMessageListener();

log('Roll20 integration ready!');
