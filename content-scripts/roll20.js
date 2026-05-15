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
   * Strip Roll20 template metacharacters from a value so it cannot break
   * out of a {{field=value}} pair or inject inline rolls.
   * Removes }} (closes field), {{ (opens field), [[ and ]] (inline rolls).
   */
  function sanitizeForTemplate(value) {
    if (value == null) return value;
    return String(value)
      .replace(/\{\{/g, '(')
      .replace(/\}\}/g, ')')
      .replace(/\[\[/g, '(')
      .replace(/\]\]/g, ')');
  }

  /**
   * Send a Save DC message as a formatted Roll20 template card (no /roll)
   * @param {Object} opts
   * @returns {boolean} Success status
   */
  function injectSaveDCCard({ moveName, characterName, saveType, saveDC, damageDice, moveType, moveTime, moveRange, moveDuration, moveDescription }) {
    const charDisplay = characterName
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : null;

    // Embed character name directly in the template name field to avoid /as encoding issues
    const cardName = sanitizeForTemplate(charDisplay ? `${charDisplay} | ${moveName}` : moveName);
    const safeSaveType = sanitizeForTemplate(saveType);
    let message = `&{template:default} {{name=${cardName}}} {{${safeSaveType} Save DC=${saveDC}}}`;
    if (damageDice) message += ` {{Damage (${damageDice})=[[${damageDice}]]}}`;
    if (moveType) message += ` {{Type=${sanitizeForTemplate(moveType)}}}`;
    if (moveTime) message += ` {{Time=${sanitizeForTemplate(moveTime)}}}`;
    if (moveRange) message += ` {{Range=${sanitizeForTemplate(moveRange)}}}`;
    if (moveDuration) message += ` {{Duration=${sanitizeForTemplate(moveDuration)}}}`;
    if (moveDescription) message += ` {{Effect=${sanitizeForTemplate(moveDescription)}}}`;

    const chatInput = findChatInput();
    if (!chatInput) {
      log('❌ Could not find chat input for Save DC card');
      return false;
    }

    chatInput.value = message;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));

    const sendButton = document.querySelector('#chatSendBtn');
    if (sendButton) sendButton.click();

    log(`✓ Save DC card sent: ${moveName} | ${saveType} Save DC ${saveDC}`);
    showNotification(`✓ Save DC ${saveDC} sent to chat`, 'success');
    return true;
  }

  /**
   * Inject a roll into chat
   * @param {Object} rollData - Roll context
   * @returns {boolean} Success status
   */
  function injectRollIntoChat(rollData) {
    log('Starting roll injection with data:', rollData);

    if (!rollData || !rollData.stat) {
      log('⚠️ Invalid roll data:', rollData);
      showNotification('Invalid roll data', 'error');
      return false;
    }

    const chatInput = findChatInput();
    if (!chatInput) {
      log('❌ ERROR: Could not find chat input element');
      showNotification('❌ Could not find Roll20 chat input', 'error');
      return false;
    }

    const { stat, rollType, label, characterName, advantage, disadvantage } = rollData;
    const mod = rollData.totalModifier ?? rollData.modifier ?? 0;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

    let diceFormula;
    if (advantage)      diceFormula = `2d20kh1${modStr}`;
    else if (disadvantage) diceFormula = `2d20kl1${modStr}`;
    else                diceFormula = `1d20${modStr}`;

    const charDisplay = characterName
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : null;

    // Field label: use supplied label (e.g. "Athletics", "STR ability", "DEX save")
    const baseLabel  = label || `${stat} ${rollType}`;
    const advTag     = advantage ? ' (ADV)' : disadvantage ? ' (DIS)' : '';
    const fieldLabel = `${baseLabel}${advTag}`;
    const cardName   = sanitizeForTemplate(charDisplay ? `${charDisplay} | ${fieldLabel}` : fieldLabel);

    const command = `&{template:default} {{name=${cardName}}} {{${fieldLabel}=[[${diceFormula}]]}}`;

    chatInput.value = command;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));

    const sendButton = document.querySelector('#chatSendBtn');
    if (sendButton) sendButton.click();

    log(`✓ Roll card sent: ${command}`);
    showNotification('✓ Roll sent to chat', 'success');
    return true;
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
   * After sending an attack card, watch for the Roll20 message to appear and,
   * if it was a natural 20, send a follow-up card with the bonus crit dice.
   * (Damage is already embedded in the first card; this only adds the extra dice.)
   */
  function watchForCritBonus({ cardName, damageDice }) {
    // Extract only the dice part (e.g. "2d8+3" → "2d8") — crit bonus has no modifier
    const bonusDice = damageDice.match(/^(\d+d\d+)/)?.[1];
    if (!bonusDice) return;

    const giveUpTimer = setTimeout(() => {
      observer.disconnect();
      log(`⚠️ watchForCritBonus timed out (no template card appeared)`);
    }, 5000);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          // Roll20 template cards render as <table> inside a wrapper div.
          // Find any table inside the added subtree (or the node itself).
          const tables = node.tagName === 'TABLE'
            ? [node]
            : [...(node.querySelectorAll?.('table') ?? [])];

          for (const table of tables) {
            // First tbody row = Attack field; fullcrit on it = natural 20
            const firstTdRoll = table.querySelector('tbody tr:first-child .inlinerollresult');
            if (!firstTdRoll) continue;

            observer.disconnect();
            clearTimeout(giveUpTimer);

            const isCrit = firstTdRoll.classList.contains('fullcrit');
            log(`Crit check: fullcrit in first tbody td = ${isCrit}`);
            if (isCrit) sendCritBonus(cardName, bonusDice);
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function sendCritBonus(cardName, bonusDice) {
    const chatInput = findChatInput();
    if (!chatInput) return;
    const cmd = `&{template:default} {{name=${cardName}}} {{Crit Bonus (${bonusDice})=[[${bonusDice}]]}}`;
    chatInput.value = cmd;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    const sendBtn = document.querySelector('#chatSendBtn');
    if (sendBtn) sendBtn.click();
    log('✓ Crit bonus damage sent:', cmd);
  }

  /**
   * Inject an attack roll using Roll20's default template (card format)
   * @param {Object} opts
   * @returns {boolean} Success status
   */
  function injectAttackTemplate({ moveName, characterName, toHit, damageDice, advantage, disadvantage, moveType, moveTime, moveRange, moveDuration, moveDescription }) {
    const chatInput = findChatInput();
    if (!chatInput) return false;

    const charDisplay = characterName
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : null;
    const cardName = sanitizeForTemplate(charDisplay ? `${charDisplay} | ${moveName}` : moveName);

    const modifierStr = toHit >= 0 ? `+${toHit}` : `${toHit}`;
    let diceFormula = `1d20${modifierStr}`;
    let fieldLabel = 'Attack';
    if (advantage) {
      diceFormula = `2d20kh1${modifierStr}`;
      fieldLabel = 'Attack (ADV)';
    } else if (disadvantage) {
      diceFormula = `2d20kl1${modifierStr}`;
      fieldLabel = 'Attack (DIS)';
    }

    let command = `&{template:default} {{name=${cardName}}} {{${fieldLabel}=[[${diceFormula}]]}}`;
    if (damageDice) command += ` {{Damage (${damageDice})=[[${damageDice}]]}}`;
    if (moveType) command += ` {{Type=${sanitizeForTemplate(moveType)}}}`;
    if (moveTime) command += ` {{Time=${sanitizeForTemplate(moveTime)}}}`;
    if (moveRange) command += ` {{Range=${sanitizeForTemplate(moveRange)}}}`;
    if (moveDuration) command += ` {{Duration=${sanitizeForTemplate(moveDuration)}}}`;
    if (moveDescription) command += ` {{Effect=${sanitizeForTemplate(moveDescription)}}}`;

    chatInput.value = command;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    const sendButton = document.querySelector('#chatSendBtn');
    if (sendButton) sendButton.click();

    // Watch for a natural 20 and send bonus crit dice if needed
    if (damageDice) {
      watchForCritBonus({ cardName, damageDice });
    }

    log('✓ Attack template injected:', command);
    showNotification('✓ Attack injected into Roll20 chat', 'success');
    return true;
  }

  /**
   * Send an info-only card (move with no attack/save roll)
   * @param {Object} opts
   * @returns {boolean} Success status
   */
  function injectInfoCard({ moveName, characterName, moveType, moveTime, moveRange, moveDuration, moveDescription }) {
    const chatInput = findChatInput();
    if (!chatInput) return false;

    const charDisplay = characterName
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : null;
    const cardName = sanitizeForTemplate(charDisplay ? `${charDisplay} | ${moveName}` : moveName);

    let command = `&{template:default} {{name=${cardName}}}`;
    if (moveType) command += ` {{Type=${sanitizeForTemplate(moveType)}}}`;
    if (moveTime) command += ` {{Time=${sanitizeForTemplate(moveTime)}}}`;
    if (moveRange) command += ` {{Range=${sanitizeForTemplate(moveRange)}}}`;
    if (moveDuration) command += ` {{Duration=${sanitizeForTemplate(moveDuration)}}}`;
    if (moveDescription) command += ` {{Effect=${sanitizeForTemplate(moveDescription)}}}`;

    chatInput.value = command;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    const sendButton = document.querySelector('#chatSendBtn');
    if (sendButton) sendButton.click();

    log(`✓ Info card sent: ${moveName}`);
    showNotification(`✓ ${moveName} sent to chat`, 'success');
    return true;
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
        log('Processing EXECUTE_ATTACK request...', request.data);
        try {
          const { 
            moveName, 
            characterName, 
            toHit, 
            damageDice, 
            advantage, 
            disadvantage,
            isSaveMove,
            saveType,
            saveDC,
            moveType,
            moveTime,
            moveRange,
            moveDuration,
            moveDescription
          } = request.data;
          
          const charDisplay = characterName
            ? (typeof characterName === 'object' ? characterName.character : characterName)
            : null;

          let success = true;

          // SAVE DC move
          if (isSaveMove && saveDC !== null && saveDC !== undefined) {
            log(`✓ Processing SAVE move: ${saveType} Save DC ${saveDC}`);
            success = injectSaveDCCard({ moveName, characterName, saveType, saveDC, damageDice, moveType, moveTime, moveRange, moveDuration, moveDescription });
          }
          // ATTACK move
          else if (toHit !== null && toHit !== undefined) {
            log(`✓ Processing ATTACK move: to-hit ${toHit}`);
            success = injectAttackTemplate({ moveName, characterName, toHit, damageDice, advantage, disadvantage, moveType, moveTime, moveRange, moveDuration, moveDescription });
          }
          // INFO-only move
          else {
            log(`✓ Processing INFO move: ${moveName}`);
            success = injectInfoCard({ moveName, characterName, moveType, moveTime, moveRange, moveDuration, moveDescription });
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

    // Storage-based listener: receives requests written by the poke5e content script.
    // This bypasses the background service worker entirely, avoiding Firefox MV3
    // service worker lifecycle issues (worker suspended = port disconnects without response).
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.pkm5eRollRequest) return;
      const req = changes.pkm5eRollRequest.newValue;
      if (!req) return; // key was removed — ignore

      log('Storage request received:', req.type, 'nonce:', req.nonce);

      try {
        if (req.type === 'ROLL_REQUEST') {
          log('Processing storage ROLL_REQUEST...');
          injectRollIntoChat(req.data);
        } else if (req.type === 'ATTACK_REQUEST') {
          log('Processing storage ATTACK_REQUEST...');
          const { moveName, characterName, toHit, damageDice, advantage, disadvantage,
                  isSaveMove, saveType, saveDC, moveType, moveTime, moveRange, moveDuration, moveDescription } = req.data;
          if (isSaveMove && saveDC !== null && saveDC !== undefined) {
            injectSaveDCCard({ moveName, characterName, saveType, saveDC, damageDice, moveType, moveTime, moveRange, moveDuration, moveDescription });
          } else if (toHit !== null && toHit !== undefined) {
            injectAttackTemplate({ moveName, characterName, toHit, damageDice, advantage, disadvantage, moveType, moveTime, moveRange, moveDuration, moveDescription });
          } else {
            injectInfoCard({ moveName, characterName, moveType, moveTime, moveRange, moveDuration, moveDescription });
          }
        }
      } catch (e) {
        log('❌ Error processing storage request:', e.message);
      }

      // Remove the key so stale requests don't replay on page reload.
      // The resulting onChanged (with newValue=undefined) is ignored by the `if (!req) return` guard above.
      chrome.storage.local.remove('pkm5eRollRequest');
    });

    log('✓ Storage request listener activated');
  }

  // Public API
  return {
    setupMessageListener,
    injectRollIntoChat,
    findChatInput,
    showNotification
  };
})();

// Initialize on page load
Roll20Integration.setupMessageListener();

log('Roll20 integration ready!');
