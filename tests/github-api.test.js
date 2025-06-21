const GitHubAPI = require('../src/github-api.js');

describe('GitHubAPI', () => {
  let api;
  const mockToken = 'test-token';
  const mockRepo = { owner: 'testuser', repo: 'testrepo' };

  beforeEach(() => {
    api = new GitHubAPI(mockToken);
    fetch.mockClear();
  });

  describe('constructor', () => {
    test('should initialize with token', () => {
      expect(api.token).toBe(mockToken);
      expect(api.baseURL).toBe('https://api.github.com');
    });
  });

  describe('getIssues', () => {
    test('should fetch issues with correct parameters', async () => {
      const mockIssues = [
        { number: 1, title: 'Test Issue', state: 'open' },
        { number: 2, title: 'Another Issue', state: 'closed' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIssues)
      });

      const result = await api.getIssues(mockRepo.owner, mockRepo.repo);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo/issues',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      expect(result).toEqual(mockIssues);
    });

    test('should handle API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      await expect(api.getIssues(mockRepo.owner, mockRepo.repo))
        .rejects.toThrow('GitHub API error: 403 Forbidden');
    });
  });

  describe('getPullRequests', () => {
    test('should fetch pull requests with correct parameters', async () => {
      const mockPRs = [
        { number: 1, title: 'Test PR', state: 'open' },
        { number: 2, title: 'Another PR', state: 'merged' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPRs)
      });

      const result = await api.getPullRequests(mockRepo.owner, mockRepo.repo);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo/pulls',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      expect(result).toEqual(mockPRs);
    });
  });

  describe('validateToken', () => {
    test('should validate token successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ login: 'testuser' })
      });

      const result = await api.validateToken();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        {
          headers: {
            'Authorization': 'Bearer test-token',
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      expect(result).toBe(true);
    });

    test('should return false for invalid token', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const result = await api.validateToken();
      expect(result).toBe(false);
    });
  });
});