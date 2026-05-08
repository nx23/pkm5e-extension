/**
 * Roll20 Content Script
 * Runs on roll20.net to receive and execute roll commands
 */

log('Content script loaded on Roll20');

const Roll20Integration = (() => {
  // Store the characterName of the most recently injected roll
  let pendingCharacterName = null;
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
    const { modifier, stat, rollType, label, characterName } = rollData;

    const modifierStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    const charDisplay = characterName
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : null;

    let diceFormula = '1d20';
    if (rollData.advantage) {
      diceFormula = '2d20kh1'; // Roll 2d20, keep highest 1
    } else if (rollData.disadvantage) {
      diceFormula = '2d20kl1'; // Roll 2d20, keep lowest 1
    }

    // ✨ Add [ADV] or [DIS] tag to label
    const advantageTag = rollData.advantage ? 'ADV ' : (rollData.disadvantage ? 'DIS ' : '');
    const labelWithTag = label ? `${advantageTag}${label}` : `${advantageTag}${stat} ${rollType}`;
    
    const rollLabel = charDisplay
      ? `${charDisplay} | ${labelWithTag}`
      : labelWithTag;

    return `${diceFormula}${modifierStr} [${rollLabel}]`;
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

      // Remember character name for styling
      pendingCharacterName = rollData.characterName || null;
      
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
          sendResponse({ success: false, message: `Error: ${error.message}`, data: request.data });
        }
        return true;
      }

      if (request.type === 'EXECUTE_ATTACK') {
        log('Processing EXECUTE_ATTACK request...');
        try {
          const { moveName, characterName, toHit, damageDice } = request.data;
          const charDisplay = characterName
            ? (typeof characterName === 'object' ? characterName.character : characterName)
            : null;
          const prefix = charDisplay ? `${charDisplay} | ` : '';

          let success = true;

          // Roll 1: attack hit roll
          if (toHit !== null && toHit !== undefined) {
            const hitMod = toHit >= 0 ? `+${toHit}` : `${toHit}`;
            success = injectRollIntoChat({
              stat: moveName,
              rollType: 'attack',
              modifier: toHit,
              label: `${prefix}${moveName} | Attack`,
              characterName: null, // already embedded in label
            });
          }

          // Roll 2: damage roll (sent after a short delay so they appear in order)
          if (damageDice) {
            setTimeout(() => {
              const chatInput = findChatInput();
              if (!chatInput) return;
              const damageLabel = `${prefix}${moveName} | Damage (${damageDice})`;
              const command = `/roll ${damageDice} [${damageLabel}]`;
              chatInput.value = command;
              chatInput.dispatchEvent(new Event('input', { bubbles: true }));
              chatInput.dispatchEvent(new Event('change', { bubbles: true }));
              const sendButton = document.querySelector('#chatSendBtn');
              if (sendButton) sendButton.click();
              // Mark the damage roll for styling
              setTimeout(() => Roll20Integration.markExtensionRoll(), 50);
              setTimeout(() => Roll20Integration.markExtensionRoll(), 200);
              log('✓ Damage roll injected:', command);
            }, 400);
          }

          sendResponse({ success });
        } catch (error) {
          log('❌ Error processing attack:', error.message);
          sendResponse({ success: false, message: `Error: ${error.message}` });
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

      /* Container: subtle tint + left accent border */
      div.message.poke5e-roll {
        background: rgba(66, 135, 245, 0.04) !important;
        border-left: 3px solid #4287f5 !important;
        border-radius: 3px !important;
      }

      /* Keep player name visible */
      div.message.poke5e-roll span.by {
        font-weight: 700 !important;
        display: inline !important;
      }

      /* Always hide "rolling 1d20+4 [label]" text */
      div.message.poke5e-roll div.formula {
        display: none !important;
      }
      #textchat > div.content strong {
        display: none !important;
      }

      /* Character name - shown as subtitle */
      div.message.poke5e-roll div.poke5e-char-header {
        display: block !important;
        font-weight: 600 !important;
        font-size: 1em !important;
        color: #666 !important;
        margin: 6px 0 8px 0 !important;
        padding: 0 !important;
        border: none !important;
      }

      /* Roll label (type of roll) - centered and bold */
      span.poke5e-label {
        display: block !important;
        width: 100% !important;
        font-weight: 600 !important;
        font-size: 1em !important;
        color: #666 !important;
        margin-bottom: 3px !important;
        text-align: center !important;
        padding: 4px 0 !important;
      }

      /* Formatted formula row - dice and modifiers */
      div.message.poke5e-roll div.formattedformula {
        display: flex !important;
        align-items: center !important;
        text-align: center !important;
        justify-content: center !important;
        flex-wrap: wrap !important;
        gap: 6px !important;
        background: #ffffff !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 3px !important;
        padding: 8px 10px !important;
        margin: 6px 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
        font-size: 1.2em !important;
      }

      /* DEFAULT: total as full-width centered gray box */
      div.message.poke5e-roll div.rolled {
        display: block !important;
        text-align: center !important;
        background: #e8e8e8 !important;
        border: 1px solid #c8c8c8 !important;
        border-radius: 3px !important;
        padding: 4px 0 !important;
        font-size: 1.6em !important;
        font-weight: 700 !important;
        color: #333 !important;
        margin: 6px 0 0 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      /* Crit success/fail colors on dice */
      }

      /* Crit success/fail colors on dice */
      div.message.poke5e-roll div.diceroll.critsuccess { color: #2e7d32 !important; font-weight: 900 !important; }
      div.message.poke5e-roll div.diceroll.critfail    { color: #b71c1c !important; font-weight: 900 !important; }
    `;
    
    document.head.appendChild(style);
    log('✓ Compact styles injected');
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
                const formula = messageEl.querySelector('.formula');
                const formulaText = formula ? formula.textContent : '';
                // Detect any roll from this extension by looking for the " | " separator
                // pattern used in all our labels: "CharName | Label" or "Label"
                const isPoke5eRoll = formulaText.includes(' | ') || [
                  'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA',
                  'check', 'save', 'skill', 'Attack', 'Damage',
                  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
                  'Deception', 'History', 'Insight', 'Intimidation',
                  'Investigation', 'Medicine', 'Nature', 'Perception',
                  'Performance', 'Persuasion', 'Religion', 'Sleight Of Hand',
                  'Stealth', 'Survival'
                ].some(kw => formulaText.includes(kw));

                if (isPoke5eRoll) {
                  messageEl.classList.add('poke5e-roll');
                  formatRollMessage(messageEl);
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
   * Extract label from formula and inject it into formattedformula
   * @param {HTMLElement} messageEl
   */
  function formatRollMessage(messageEl, characterName) {
    if (!messageEl || messageEl.dataset.poke5eFormatted) return;
    messageEl.dataset.poke5eFormatted = 'true';

    const formulaEl = messageEl.querySelector('.formula');
    const formattedEl = messageEl.querySelector('.formattedformula');
    
    if (!formulaEl || !formattedEl) return;

    // Extract label and split by " | " separator
    const labelMatch = formulaEl.textContent.match(/\[([^\]]+)\]/);
    if (!labelMatch) return;
    
    const fullLabel = labelMatch[1];
    const parts = fullLabel.split(' | ');
    const charName = parts.length > 1 ? parts[0] : null;
    const rollLabel = parts.length > 1 ? parts.slice(1).join(' | ') : fullLabel;

    // Determine name to display
    const nameDisplay = characterName 
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : charName;

    // 1. Insert character name header right before formattedEl (as a sibling)
    if (nameDisplay && !messageEl.querySelector('.poke5e-char-header')) {
      const header = document.createElement('div');
      header.className = 'poke5e-char-header';
      header.textContent = nameDisplay;
      // Insert right before formattedEl
      formattedEl.parentNode.insertBefore(header, formattedEl);
      log(`✓ Injected character header: ${nameDisplay}`);
    }

    // 2. Create roll label (inside formattedformula at the start)
    if (rollLabel && !formattedEl.querySelector('.poke5e-label')) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'poke5e-label';
      labelSpan.textContent = rollLabel;
      formattedEl.insertBefore(labelSpan, formattedEl.firstChild);
    }

    // 3. Wrap bare text nodes (modifiers like "+6")
    Array.from(formattedEl.childNodes).forEach(node => {
      if (node.nodeType === 3 && node.textContent.trim()) {
        const span = document.createElement('span');
        span.className = 'poke5e-modifier-text';
        span.textContent = node.textContent;
        formattedEl.replaceChild(span, node);
      }
    });

    log('✓ Formatted roll message');
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
      
      if (!lastMessage.classList.contains('poke5e-roll')) {
        lastMessage.classList.add('poke5e-roll');
        log('✓ Marked roll with poke5e-roll class');
      }
      formatRollMessage(lastMessage, pendingCharacterName);
      pendingCharacterName = null;
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
