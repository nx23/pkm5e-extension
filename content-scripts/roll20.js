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

    // Add ADV or DIS tag immediately before the move/roll name
    // If the label already contains " | " (character name embedded by EXECUTE_ATTACK),
    // insert the tag after the first separator so the result is "CharName | ADV MoveName | Attack"
    // instead of "ADV CharName | MoveName | Attack".
    const advantageTag = rollData.advantage ? 'ADV ' : (rollData.disadvantage ? 'DIS ' : '');
    let labelWithTag;
    if (!label) {
      labelWithTag = `${advantageTag}${stat} ${rollType}`;
    } else if (advantageTag) {
      const pipeIndex = label.indexOf(' | ');
      labelWithTag = pipeIndex !== -1
        ? label.slice(0, pipeIndex + 3) + advantageTag + label.slice(pipeIndex + 3)
        : `${advantageTag}${label}`;
    } else {
      labelWithTag = label;
    }
    
    const rollLabel = charDisplay
      ? `${charDisplay} | ${labelWithTag}`
      : labelWithTag;

    return `${diceFormula}${modifierStr} [${rollLabel}]`;
  }

  /**
   * Send a Save DC message as a formatted Roll20 template card (no /roll)
   * @param {Object} opts
   * @returns {boolean} Success status
   */
  function injectSaveDCCard({ moveName, characterName, saveType, saveDC }) {
    const charDisplay = characterName
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : null;

    // Embed character name directly in the template name field to avoid /as encoding issues
    const cardName = charDisplay ? `${charDisplay} | ${moveName}` : moveName;
    const message = `&{template:default} {{name=${cardName}}} {{${saveType} Save DC=${saveDC}}}`;

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

      // Dispatch input/change events so Roll20's jQuery listeners (attached to parent
      // elements) detect the new value and enable the send button.
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      chatInput.dispatchEvent(new Event('change', { bubbles: true }));
      log('✓ Events dispatched');

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
   * Double the damage dice formula for critical hits
   * @param {string} damageDice - Original damage formula (e.g., "1d6", "2d8+3")
   * @returns {string} Doubled formula (e.g., "2d6", "4d8+3")
   */
  function doubleDamageForCritical(damageDice) {
    // Match pattern: "XdY" or "XdY+Z" or "XdY-Z"
    const match = damageDice.match(/^(\d+)d(\d+)(.*?)$/);
    if (!match) return damageDice; // Return unchanged if pattern doesn't match

    const [, numDice, diceType, modifier] = match;
    const doubled = parseInt(numDice) * 2;
    const result = `${doubled}d${diceType}${modifier}`;
    
    log(`✓ Doubled damage: ${damageDice} → ${result}`);
    return result;
  }

  /**
   * Observe the chat DOM for the attack roll result, then immediately roll damage.
   *
   * A MutationObserver is used instead of a fixed setTimeout because Roll20's
   * render time is unpredictable. The observer fires the moment the attack
   * message appears, checks for a natural 20, and rolls the correct damage.
   *
   * Falls back to rolling without critical doubling if no message appears
   * within 5 seconds.
   *
   * @param {Object} opts
   * @param {string} opts.prefix      - "CharName | " or empty string
   * @param {string} opts.moveName    - Name of the move (e.g. "Bubble")
   * @param {string} opts.damageDice  - Base damage formula (e.g. "2d6+4")
   */
  function waitForAttackMessageThenRollDamage({ prefix, moveName, damageDice }) {
    const chatContainer = document.querySelector('#textchat') ||
                          document.querySelector('#chat') ||
                          document.querySelector('.chat-container');

    if (!chatContainer) {
      log('⚠️ Chat container not found for observer, falling back to timeout');
      setTimeout(() => rollDamage({ prefix, moveName, damageDice, isCritical: false }), 800);
      return;
    }

    // Safety: give up after 5 seconds
    const giveUpTimer = setTimeout(() => {
      observer.disconnect();
      log('⚠️ Timed out waiting for attack message, rolling damage without critical check');
      rollDamage({ prefix, moveName, damageDice, isCritical: false });
    }, 5000);

    // Count existing messages before the attack is sent
    const messagesBefore = chatContainer.querySelectorAll('.message').length;

    const observer = new MutationObserver(() => {
      // Wait for a NEW message to appear after the attack was sent
      const messages = chatContainer.querySelectorAll('.message');
      if (messages.length <= messagesBefore) return;

      const attackMsg = messages[messagesBefore]; // first new message = attack result

      observer.disconnect();
      clearTimeout(giveUpTimer);

      log(`Attack message found (template or /roll)`);

      const isCritical = checkMessageForCritical(attackMsg);
      log(`Critical hit check result: ${isCritical}`);

      rollDamage({ prefix, moveName, damageDice, isCritical });
    });

    observer.observe(chatContainer, { childList: true, subtree: true });
    log('Waiting for attack message to appear in DOM...');
  }

  /**
   * Check a specific message element for a natural 20 (critical)
   * Only considers dice that were actually kept
   * dropped dice (from advantage/disadvantage rolls)
   * are ignored via the `.dropped` class that Roll20 adds to discarded dice.
   * @param {HTMLElement} messageEl
   * @returns {boolean}
   */
  function checkMessageForCritical(messageEl) {
    // --- Old /roll format: .diceroll.d20 ---
    const diceRolls = messageEl.querySelectorAll('.diceroll.d20');
    log(`Found ${diceRolls.length} d20 diceroll elements`);
    for (const roll of diceRolls) {
      if (roll.classList.contains('dropped')) continue;
      const rollText = roll.textContent.trim();
      if (roll.classList.contains('critsuccess') || rollText === '20') {
        log('✓✓✓ CRITICAL HIT DETECTED (diceroll) ✓✓✓');
        return true;
      }
    }

    // --- Template format: .inlinerollresult ---
    const inlineRolls = messageEl.querySelectorAll('.inlinerollresult');
    log(`Found ${inlineRolls.length} inlinerollresult elements`);
    for (const roll of inlineRolls) {
      if (roll.classList.contains('critSuccess') || roll.classList.contains('critsuccess')) {
        log('✓✓✓ CRITICAL HIT DETECTED (inline roll) ✓✓✓');
        return true;
      }
    }

    log('❌ No critical hit detected');
    return false;
  }

  /**
   * Roll damage (used after critical check)
   * @param {Object} opts - { prefix, moveName, damageDice, isCritical }
   */
  function rollDamage({ prefix, moveName, damageDice, isCritical }) {
    const chatInput = findChatInput();
    if (!chatInput) return;

    const finalDamageDice = isCritical ? doubleDamageForCritical(damageDice) : damageDice;
    const fieldLabel = isCritical ? `CRITICAL Damage` : `Damage (${finalDamageDice})`;
    // prefix is "CharName | " — strip trailing separator for the card name
    const cardName = prefix
      ? `${prefix.replace(/ \| $/, '')} | ${moveName}`
      : moveName;
    const command = `&{template:default} {{name=${cardName}}} {{${fieldLabel}=[[${finalDamageDice}]]}}`;

    log(`Rolling damage: ${command}`);
    chatInput.value = command;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    const sendButton = document.querySelector('#chatSendBtn');
    if (sendButton) sendButton.click();

    log('✓ Damage roll injected:', command);
  }

  /**
   * Inject an attack roll using Roll20's default template (card format)
   * @param {Object} opts
   * @returns {boolean} Success status
   */
  function injectAttackTemplate({ moveName, characterName, toHit, advantage, disadvantage }) {
    const chatInput = findChatInput();
    if (!chatInput) return false;

    const charDisplay = characterName
      ? (typeof characterName === 'object' ? characterName.character : characterName)
      : null;
    const cardName = charDisplay ? `${charDisplay} | ${moveName}` : moveName;

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

    const command = `&{template:default} {{name=${cardName}}} {{${fieldLabel}=[[${diceFormula}]]}}`;

    chatInput.value = command;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    const sendButton = document.querySelector('#chatSendBtn');
    if (sendButton) sendButton.click();

    log('✓ Attack template injected:', command);
    showNotification('✓ Attack injected into Roll20 chat', 'success');
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
            saveDC
          } = request.data;
          
          const charDisplay = characterName
            ? (typeof characterName === 'object' ? characterName.character : characterName)
            : null;
          const prefix = charDisplay ? `${charDisplay} | ` : '';

          let success = true;

          // SAVE DC move: Inject card directly into Roll20 DOM (no /roll)
          if (isSaveMove && saveDC !== null && saveDC !== undefined) {
            log(`✓ Processing SAVE move: ${saveType} Save DC ${saveDC}`);
            success = injectSaveDCCard({ moveName, characterName, saveType, saveDC });
          }
          // ATTACK move: Roll to-hit using template card
          else if (toHit !== null && toHit !== undefined) {
            log(`✓ Processing ATTACK move: to-hit ${toHit}`);
            success = injectAttackTemplate({ moveName, characterName, toHit, advantage, disadvantage });
          }

          // Roll damage for both attack and save moves
          if (damageDice) {
            waitForAttackMessageThenRollDamage({
              prefix, moveName, damageDice,
            });
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
