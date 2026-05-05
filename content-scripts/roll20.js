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
      
      // Mark the roll message with extension styling
      // Try immediately and also with delay in case Roll20 renders async
      Roll20Integration.markExtensionRoll();
      setTimeout(() => {
        Roll20Integration.markExtensionRoll();
      }, 50);
      setTimeout(() => {
        Roll20Integration.markExtensionRoll();
      }, 200);
      
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

  /**
   * Inject custom CSS for styling roll results
   */
  function injectCustomStyles() {
    log('Injecting custom Roll20 styles...');
    
    // Remove any existing extension styles to avoid duplicates
    const existing = document.querySelector('style[data-poke5e-styles]');
    if (existing) {
      existing.remove();
    }
    
    const style = document.createElement('style');
    style.setAttribute('data-poke5e-styles', 'true');
    style.textContent = `
      /* Pokemon 5e Roll20 Extension Styles */
      
      /* General message styling for extension rolls */
      div.message.poke5e-roll {
        background: linear-gradient(135deg, rgba(66, 135, 245, 0.15) 0%, rgba(102, 51, 153, 0.15) 100%) !important;
        border-left: 4px solid #4287f5 !important;
        border-radius: 6px !important;
        transition: all 0.3s ease !important;
      }
      
      div.message.poke5e-roll:hover {
        background: linear-gradient(135deg, rgba(66, 135, 245, 0.25) 0%, rgba(102, 51, 153, 0.25) 100%) !important;
        border-left-color: #6633ff !important;
        box-shadow: 0 4px 12px rgba(66, 135, 245, 0.3) !important;
      }
      
      /* Formula styling - the text formula */
      div.message.poke5e-roll div.formula {
        font-weight: 700 !important;
        font-size: 1.15em !important;
        color: #2952cc !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        padding: 10px 0 !important;
      }
      
      /* Formatted formula (the actual dice result) */
      div.message.poke5e-roll div.formattedformula {
        background: linear-gradient(135deg, rgba(66, 135, 245, 0.08) 0%, rgba(102, 51, 153, 0.08) 100%) !important;
        padding: 12px 14px !important;
        border-radius: 6px !important;
        font-weight: 700 !important;
        font-size: 1.05em !important;
        color: #2c2c2c !important;
        margin: 10px 0 !important;
        border-left: 3px solid #4287f5 !important;
      }
      
      /* Dice roll container */
      div.message.poke5e-roll div.dicegrouping {
        background: linear-gradient(135deg, #fff9e6 0%, #ffe6cc 100%) !important;
        padding: 10px !important;
        border-radius: 6px !important;
        border: 3px solid #ffd700 !important;
        display: inline-block !important;
        font-weight: bold !important;
        margin: 0 6px !important;
        box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3) !important;
      }
      
      /* Individual dice */
      div.message.poke5e-roll div.diceroll {
        background: linear-gradient(135deg, #fff 0%, #f9f9f9 100%) !important;
        border: 2px solid #d0d0d0 !important;
        border-radius: 5px !important;
        padding: 8px 12px !important;
        font-weight: bold !important;
        color: #333 !important;
        margin: 0 3px !important;
        transition: all 0.2s ease !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 32px !important;
      }
      
      /* Critical success styling */
      div.message.poke5e-roll div.diceroll.critsuccess {
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%) !important;
        border-color: #2e7d32 !important;
        color: white !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4) !important;
        box-shadow: 0 4px 10px rgba(76, 175, 80, 0.5) !important;
        transform: scale(1.15) !important;
      }
      
      /* Critical fail styling */
      div.message.poke5e-roll div.diceroll.critfail {
        background: linear-gradient(135deg, #f44336 0%, #da190b 100%) !important;
        border-color: #b71c1c !important;
        color: white !important;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4) !important;
        box-shadow: 0 4px 10px rgba(244, 67, 54, 0.5) !important;
        transform: scale(1.15) !important;
      }
      
      /* Result number styling */
      div.message.poke5e-roll div.rolled {
        background: linear-gradient(135deg, #6633ff 0%, #4287f5 100%) !important;
        color: white !important;
        font-weight: 900 !important;
        font-size: 1.4em !important;
        padding: 10px 16px !important;
        border-radius: 8px !important;
        box-shadow: 0 6px 16px rgba(102, 51, 255, 0.4) !important;
        text-shadow: 0 3px 6px rgba(0, 0, 0, 0.4) !important;
        border: 2px solid rgba(255, 255, 255, 0.3) !important;
        display: inline-block !important;
        min-width: 48px !important;
        text-align: center !important;
        margin: 0 6px !important;
      }
      
      /* Equal sign */
      div.message.poke5e-roll strong {
        color: #4287f5 !important;
        font-size: 1.2em !important;
        margin: 0 6px !important;
        font-weight: 900 !important;
      }
      
      /* Timestamp styling */
      div.message.poke5e-roll span.tstamp {
        color: #6633ff !important;
        font-weight: 700 !important;
      }
      
      /* Player name styling */
      div.message.poke5e-roll span.by {
        color: #4287f5 !important;
        font-weight: 800 !important;
      }
    `;
    
    document.head.appendChild(style);
    log('✓ Custom styles injected with !important flags');
  }

  /**
   * Setup observer for new roll messages
   * Automatically style rolls from the extension
   */
  function setupRollObserver() {
    log('Setting up roll message observer...');
    
    const chatContainer = document.querySelector('#chat') || 
                         document.querySelector('.chat-container') ||
                         document.querySelector('[class*="chat"]');
    
    if (!chatContainer) {
      log('⚠️ Chat container not found for observer');
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            // Check if this is a message element
            if (node.nodeType === 1 && node.classList) { // Element node
              let messageEl = node;
              
              // If it's a wrapper, find the message inside
              if (!messageEl.classList.contains('message')) {
                messageEl = node.querySelector('.message.rollresult');
              }
              
              // Check if this is a rollresult message
              if (messageEl && messageEl.classList.contains('rollresult')) {
                // Check if it contains Pokemon 5e indicators
                const formula = messageEl.querySelector('.formula');
                if (formula && formula.textContent.includes('STR') || 
                    formula.textContent.includes('DEX') ||
                    formula.textContent.includes('CON') ||
                    formula.textContent.includes('INT') ||
                    formula.textContent.includes('WIS') ||
                    formula.textContent.includes('CHA') ||
                    formula.textContent.includes('Athletics') ||
                    formula.textContent.includes('Perception') ||
                    formula.textContent.includes('save') ||
                    formula.textContent.includes('roll')) {
                  
                  messageEl.classList.add('poke5e-roll');
                  log('✓ Styled new roll message');
                }
              }
            }
          });
        }
      });
    });
    
    observer.observe(chatContainer, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    log('✓ Roll observer active');
  }

  /**
   * Mark a roll message as coming from the extension
   * Call this when you inject a roll to add the poke5e-roll class
   */
  function markExtensionRoll() {
    log('Attempting to mark extension roll...');
    
    // Find the most recent rollresult message
    const messages = document.querySelectorAll('.message.rollresult');
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Check if it already has the class
      if (!lastMessage.classList.contains('poke5e-roll')) {
        lastMessage.classList.add('poke5e-roll');
        log('✓ Marked roll with poke5e-roll class');
      } else {
        log('Roll already marked');
      }
    } else {
      log('⚠️ No rollresult messages found');
    }
  }

  // Public API
  return {
    setupMessageListener,
    injectRollIntoChat,
    generateDiceFormula,
    findChatInput,
    showNotification,
    injectCustomStyles,
    markExtensionRoll,
    setupRollObserver
  };
})();

// Initialize on page load
Roll20Integration.setupMessageListener();
Roll20Integration.injectCustomStyles();

// Give page time to load, then setup observer
setTimeout(() => {
  Roll20Integration.setupRollObserver();
}, 1000);

log('Roll20 integration ready!');
