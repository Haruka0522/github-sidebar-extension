class GitHubAPI {
  constructor(token) {
    this.token = token;
    this.baseURL = 'https://api.github.com';
  }

  async makeRequest(endpoint) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getIssues(owner, repo, params = {}) {
    const queryParams = new URLSearchParams(params);
    const queryString = queryParams.toString();
    const endpoint = `/repos/${owner}/${repo}/issues${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest(endpoint);
  }

  async getPullRequests(owner, repo, params = {}) {
    const queryParams = new URLSearchParams(params);
    const queryString = queryParams.toString();
    const endpoint = `/repos/${owner}/${repo}/pulls${queryString ? `?${queryString}` : ''}`;
    return this.makeRequest(endpoint);
  }

  async validateToken() {
    try {
      await this.makeRequest('/user');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getRepository(owner, repo) {
    return this.makeRequest(`/repos/${owner}/${repo}`);
  }

  async getIssueDetails(owner, repo, issueNumber) {
    return this.makeRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  async getIssueComments(owner, repo, issueNumber) {
    return this.makeRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
  }
}

// Node.js環境でのエクスポート（テスト用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubAPI;
}