document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const toggle = document.getElementById('scannerToggle');
  const statusText = document.getElementById('statusText');
  
  const statTotal = document.getElementById('statTotal');
  const statVerified = document.getElementById('statVerified');
  const statSuspicious = document.getElementById('statSuspicious');
  
  const flaggedCount = document.getElementById('flaggedCount');
  const flaggedList = document.getElementById('flaggedList');
  const emptyState = document.getElementById('emptyState');

  // Initialize toggle state
  chrome.storage.local.get(['scannerEnabled', 'frdScanResults'], (result) => {
    const isEnabled = result.scannerEnabled !== false; // Default to true if undefined
    toggle.checked = isEnabled;
    updateStatusText(isEnabled);

    // Initialize stats and flagged items
    const scanData = result.frdScanResults || { total: 0, verified: 0, suspicious: 0, flagged: [] };
    updateUI(scanData);
  });

  // Listen for real-time updates from content/background scripts
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.frdScanResults) {
      updateUI(changes.frdScanResults.newValue || { total: 0, verified: 0, suspicious: 0, flagged: [] });
    }
  });

  // Handle toggle change
  toggle.addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    updateStatusText(isEnabled);
    
    // Save to storage
    await chrome.storage.local.set({ scannerEnabled: isEnabled });

    // Send message to background script
    chrome.runtime.sendMessage({ type: 'SCANNER_TOGGLED', enabled: isEnabled });

    // Trigger rescan in active tab if enabling
    if (isEnabled) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          // Dispatch custom event via content script to trigger rescan
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              window.dispatchEvent(new CustomEvent('frd-rescan'));
            }
          }).catch(err => console.error('Could not execute script:', err));
        }
      } catch (err) {
        console.error('Error querying tabs:', err);
      }
    }
  });

  function updateStatusText(isEnabled) {
    statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
  }

  function updateUI(data) {
    // Update stat cards
    statTotal.textContent = data.total || 0;
    statVerified.textContent = data.verified || 0;
    statSuspicious.textContent = data.suspicious || 0;

    // Update flagged section
    const flaggedItems = data.flagged || [];
    flaggedCount.textContent = flaggedItems.length;

    // Clear current list
    flaggedList.innerHTML = '';

    if (flaggedItems.length === 0) {
      emptyState.style.display = 'block';
      flaggedList.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      flaggedList.style.display = 'flex';

      // Build item cards
      flaggedItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'flagged-item';
        
        // Add specific border styling if AI generated
        if (item.hasAi) {
          card.classList.add('ai-item');
        }

        const header = document.createElement('div');
        header.className = 'flagged-item-header';

        const author = document.createElement('span');
        author.className = 'flagged-author';
        author.textContent = item.author || 'Unknown';

        const score = document.createElement('span');
        score.className = 'trust-score';
        if (item.hasAi) {
          score.classList.add('trust-score--ai');
          score.textContent = `🤖 ${item.aiPercentage}% AI (${item.trustScore ?? '-'})`;
        } else {
          score.textContent = `Score: ${item.trustScore ?? '-'}`;
        }

        header.appendChild(author);
        header.appendChild(score);
        card.appendChild(header);

        if (item.reasons && item.reasons.length > 0) {
          const reasonsList = document.createElement('ul');
          reasonsList.className = 'flagged-reasons';
          item.reasons.forEach(reason => {
            const li = document.createElement('li');
            li.textContent = reason;
            reasonsList.appendChild(li);
          });
          card.appendChild(reasonsList);
        }

        flaggedList.appendChild(card);
      });
    }
  }
});
