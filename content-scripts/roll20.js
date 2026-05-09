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

    const observer = new MutationObserver(() => {
      // Look for a new .message.rollresult that contains a d20 formula (the attack)
      const messages = document.querySelectorAll('.message.rollresult');
      if (messages.length === 0) return;

      const lastMsg = messages[messages.length - 1];
      const formulaEl = lastMsg.querySelector('.formula');
      const formulaText = formulaEl ? formulaEl.textContent : '';

      // Only react to a d20 roll (the attack), not any other pending message
      if (!formulaText.includes('d20')) return;

      observer.disconnect();
      clearTimeout(giveUpTimer);

      log(`Attack message found: "${formulaText}"`);

      // Now check for critical on this exact message
      const isCritical = checkMessageForCritical(lastMsg);
      log(`Critical hit check result: ${isCritical}`);

      rollDamage({ prefix, moveName, damageDice, isCritical });
    });

    observer.observe(chatContainer, { childList: true, subtree: true });
    log('Waiting for attack message to appear in DOM...');
  }

  /**
   * Check a specific message element for a natural 20 (critical)
   * @param {HTMLElement} messageEl
   * @returns {boolean}
   */
  function checkMessageForCritical(messageEl) {
    const diceRolls = messageEl.querySelectorAll('.diceroll.d20');
    log(`Found ${diceRolls.length} d20 diceroll elements`);

    for (const roll of diceRolls) {
      const rollText = roll.textContent.trim();
      const classes = roll.className;
      log(`  d20 diceroll: text="${rollText}", classes="${classes}"`);

      if (roll.classList.contains('critsuccess') || rollText === '20') {
        log('✓✓✓ CRITICAL HIT DETECTED ✓✓✓');
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
    const criticalLabel = isCritical ? ' CRITICAL' : '';
    const damageLabel = `${prefix}${moveName} | Damage (${finalDamageDice})${criticalLabel}`;
    const command = `/roll ${finalDamageDice} [${damageLabel}]`;

    log(`Rolling damage: ${command}`);
    chatInput.value = command;
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    const sendButton = document.querySelector('#chatSendBtn');
    if (sendButton) sendButton.click();

    setTimeout(() => Roll20Integration.markExtensionRoll(), 50);
    setTimeout(() => Roll20Integration.markExtensionRoll(), 200);
    log('✓ Damage roll injected:', command);
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
          const { moveName, characterName, toHit, damageDice, advantage, disadvantage } = request.data;
          const charDisplay = characterName
            ? (typeof characterName === 'object' ? characterName.character : characterName)
            : null;
          const prefix = charDisplay ? `${charDisplay} | ` : '';

          let success = true;

          // Roll 1: attack hit roll
          if (toHit !== null && toHit !== undefined) {
            success = injectRollIntoChat({
              stat: moveName,
              rollType: 'attack',
              modifier: toHit,
              label: `${prefix}${moveName} | Attack`,
              characterName: null,
              advantage,
              disadvantage,
            });
          }

          // Roll 2: damage roll — wait for the attack message to appear in the DOM
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

      /* Natural 20 = green, natural 1 = red */
      div.message.poke5e-roll div.diceroll.critsuccess { color: #2e7d32 !important; font-weight: 900 !important; }
      div.message.poke5e-roll div.diceroll.critfail    { color: #b71c1c !important; font-weight: 900 !important; }
    `;
    
    document.head.appendChild(style);
    log('✓ Compact styles injected');
  }

  /**
   * Observe the chat for new roll messages and apply extension styling.
   * Roll20 renders messages asynchronously, so a MutationObserver is used
   * instead of querying the DOM at a fixed point in time.
   */
  function setupRollObserver() {
    log('Setting up roll message observer...');

    // #chat is the Roll20 chat log container
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
                // All extension roll labels follow the pattern "CharName | Label",
                // so the " | " separator is a reliable fingerprint. The keyword
                // list catches stat/skill rolls that may not include a character name.
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
   * Parse the roll label from the formula text and inject a character header
   * and a roll-type label into the message element for display.
   *
   * Labels follow the format: "[CharName | Roll Label]"
   * e.g. "[Bubble | Attack]" or "[Bubble | Damage (2d6+4)]"
   *
   * @param {HTMLElement} messageEl - The .message.rollresult element to format
   * @param {string} [characterName] - Optional override for the character name
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
   * Apply extension styling to the most recent roll message.
   * Called after injecting a roll command, with retries to account for
   * Roll20's async rendering.
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
