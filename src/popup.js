// Popup script for GitHub Sidebar Extension

class PopupManager {
  constructor() {
    this.currentTab = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadCurrentToken();
    await this.getCurrentTab();
    this.updateCurrentRepoInfo();
  }

  setupEventListeners() {
    // Save token button
    document.getElementById('save-token-btn').addEventListener('click', () => {
      this.saveToken();
    });

    // Toggle sidebar button
    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshSidebar();
    });

    // Token input enter key
    document.getElementById('token-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveToken();
      }
    });
  }

  async loadCurrentToken() {
    try {
      const response = await this.sendMessage({ action: 'GET_TOKEN' });
      if (response.success && response.token) {
        const tokenInput = document.getElementById('token-input');
        tokenInput.value = response.token;
        this.showStatus('Token loaded', 'success');
      }
    } catch (error) {
      // Failed to load token
    }
  }

  async saveToken() {
    const tokenInput = document.getElementById('token-input');
    const token = tokenInput.value.trim();

    if (!token) {
      this.showStatus('Please enter a token', 'error');
      return;
    }

    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      this.showStatus('Invalid token format', 'error');
      return;
    }

    try {
      this.showStatus('Saving token...', 'info');
      
      const response = await this.sendMessage({
        action: 'SAVE_TOKEN',
        payload: { token }
      });

      if (response.success) {
        // Validate the token
        const validateResponse = await this.sendMessage({
          action: 'VALIDATE_TOKEN'
        });

        if (validateResponse.success && validateResponse.valid) {
          this.showStatus('Token saved and validated successfully!', 'success');
        } else {
          this.showStatus('Token saved but validation failed', 'error');
        }
      } else {
        this.showStatus('Failed to save token', 'error');
      }
    } catch (error) {
      this.showStatus('Error saving token', 'error');
      // Save token error
    }
  }

  async toggleSidebar() {
    if (!this.currentTab) {
      this.showStatus('No active tab found', 'error');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'TOGGLE_SIDEBAR'
      });

      if (response && response.success) {
        const status = response.visible ? 'Sidebar shown' : 'Sidebar hidden';
        this.showStatus(status, 'success');
      } else {
        this.showStatus(response.error || 'Failed to toggle sidebar', 'error');
      }
    } catch (error) {
      this.showStatus('Error: Not on a GitHub page', 'error');
      // Toggle sidebar error
    }
  }

  async refreshSidebar() {
    if (!this.currentTab) {
      this.showStatus('No active tab found', 'error');
      return;
    }

    try {
      // Send refresh message to content script
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'REFRESH_SIDEBAR'
      });

      this.showStatus('Sidebar refreshed', 'success');
    } catch (error) {
      this.showStatus('Error: Not on a GitHub page', 'error');
      // Refresh sidebar error
    }
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      // Failed to get current tab
    }
  }

  async updateCurrentRepoInfo() {
    const repoDiv = document.getElementById('current-repo');

    if (!this.currentTab) {
      repoDiv.textContent = 'No active tab';
      repoDiv.className = 'status error';
      return;
    }

    // Check if current tab is GitHub
    if (!this.currentTab.url.includes('github.com')) {
      repoDiv.textContent = 'Not on GitHub';
      repoDiv.className = 'status error';
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'GET_CURRENT_REPO'
      });

      if (response && response.success) {
        if (response.repo) {
          repoDiv.textContent = `${response.repo.owner}/${response.repo.repo}`;
          repoDiv.className = 'status success';
        } else {
          repoDiv.textContent = 'Not in a repository';
          repoDiv.className = 'status info';
        }
      } else {
        repoDiv.textContent = 'Failed to detect repository';
        repoDiv.className = 'status error';
      }
    } catch (error) {
      repoDiv.textContent = 'Extension not loaded on this page';
      repoDiv.className = 'status error';
      // Get current repo error
    }
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');

    statusText.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});