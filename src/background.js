// Service Worker for Chrome Extension
// GitHub API interactions and message handling

class BackgroundManager {
  constructor() {
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 非同期レスポンスを有効にする
    });
  }



  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'GET_ISSUES':
          await this.handleGetIssues(message.payload, sendResponse);
          break;
        
        case 'GET_PULL_REQUESTS':
          await this.handleGetPullRequests(message.payload, sendResponse);
          break;
        
        case 'SAVE_TOKEN':
          await this.handleSaveToken(message.payload, sendResponse);
          break;
        
        case 'GET_TOKEN':
          await this.handleGetToken(sendResponse);
          break;
        
        case 'VALIDATE_TOKEN':
          await this.handleValidateToken(sendResponse);
          break;
        
        case 'GET_ISSUE_DETAILS':
          await this.handleGetIssueDetails(message.payload, sendResponse);
          break;
        
        case 'GET_PR_DETAILS':
          await this.handleGetPRDetails(message.payload, sendResponse);
          break;
        
        case 'GET_ISSUE_COMMENTS':
          await this.handleGetIssueComments(message.payload, sendResponse);
          break;
        
        case 'FETCH_GITHUB_PAGE':
          await this.handleFetchGithubPage(message.payload, sendResponse);
          break;
        
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetIssues(payload, sendResponse) {
    const { owner, repo, params = {} } = payload;
    const token = await this.getStoredToken();
    
    if (!token) {
      sendResponse({ success: false, error: 'No GitHub token found' });
      return;
    }

    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `https://api.github.com/repos/${owner}/${repo}/issues${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetPullRequests(payload, sendResponse) {
    const { owner, repo, params = {} } = payload;
    const token = await this.getStoredToken();
    
    if (!token) {
      sendResponse({ success: false, error: 'No GitHub token found' });
      return;
    }

    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleSaveToken(payload, sendResponse) {
    const { token } = payload;
    
    try {
      await chrome.storage.local.set({ github_token: token });
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetToken(sendResponse) {
    try {
      const token = await this.getStoredToken();
      sendResponse({ success: true, token });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleValidateToken(sendResponse) {
    const token = await this.getStoredToken();
    
    if (!token) {
      sendResponse({ success: false, error: 'No token found' });
      return;
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const isValid = response.ok;
      sendResponse({ success: true, valid: isValid });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetIssueDetails(payload, sendResponse) {
    const { owner, repo, number } = payload;
    const token = await this.getStoredToken();
    
    if (!token) {
      sendResponse({ success: false, error: 'No GitHub token found' });
      return;
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetPRDetails(payload, sendResponse) {
    const { owner, repo, number } = payload;
    const token = await this.getStoredToken();
    
    if (!token) {
      sendResponse({ success: false, error: 'No GitHub token found' });
      return;
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetIssueComments(payload, sendResponse) {
    const { owner, repo, number } = payload;
    const token = await this.getStoredToken();
    
    if (!token) {
      sendResponse({ success: false, error: 'No GitHub token found' });
      return;
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleFetchGithubPage(payload, sendResponse) {
    const { url } = payload;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`GitHub page fetch error: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      sendResponse({ success: true, content });
      
    } catch (error) {
      console.error('Failed to fetch GitHub page:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getStoredToken() {
    const result = await chrome.storage.local.get(['github_token']);
    return result.github_token;
  }
}

// Service Workerの初期化
new BackgroundManager();