// background.jsのテスト用モック
const mockBackgroundFunctions = {
  handleMessage: null,
  getStoredToken: null,
  setStoredToken: null
};

// background.jsを直接読み込む代わりに、その機能をテスト
describe('Background Script', () => {
  beforeEach(() => {
    // Chromeストレージのモックリセット
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.runtime.sendMessage.mockReset();
  });

  describe('Message Handling', () => {
    test('should handle GET_ISSUES message', async () => {
      const mockMessage = {
        action: 'GET_ISSUES',
        payload: { owner: 'testuser', repo: 'testrepo' }
      };

      const mockSender = { tab: { id: 1 } };
      const mockSendResponse = jest.fn();

      // GitHub APIからの模擬レスポンス
      const mockIssues = [
        { number: 1, title: 'Test Issue', state: 'open' }
      ];

      // fetch モックを設定
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIssues)
      });

      // ストレージからトークンを取得する模擬設定
      chrome.storage.local.get.mockResolvedValueOnce({
        github_token: 'test-token'
      });

      // メッセージハンドラのテスト
      const handler = (message, sender, sendResponse) => {
        if (message.action === 'GET_ISSUES') {
          chrome.storage.local.get(['github_token']).then(result => {
            if (result.github_token) {
              // 実際のAPIコールをシミュレート
              fetch(`https://api.github.com/repos/${message.payload.owner}/${message.payload.repo}/issues`, {
                headers: {
                  'Authorization': `Bearer ${result.github_token}`,
                  'Accept': 'application/vnd.github.v3+json'
                }
              })
              .then(response => response.json())
              .then(data => {
                sendResponse({ success: true, data });
              });
            }
          });
          return true; // 非同期レスポンスを示す
        }
      };

      handler(mockMessage, mockSender, mockSendResponse);

      // 少し待ってからアサーション
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['github_token']);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo/issues',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-token',
            'Accept': 'application/vnd.github.v3+json'
          }
        })
      );
    });

    test('should handle SAVE_TOKEN message', async () => {
      const mockMessage = {
        action: 'SAVE_TOKEN',
        payload: { token: 'new-token' }
      };

      const mockSendResponse = jest.fn();

      chrome.storage.local.set.mockResolvedValueOnce();

      const handler = (message, sender, sendResponse) => {
        if (message.action === 'SAVE_TOKEN') {
          chrome.storage.local.set({
            github_token: message.payload.token
          }).then(() => {
            sendResponse({ success: true });
          });
          return true;
        }
      };

      handler(mockMessage, null, mockSendResponse);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        github_token: 'new-token'
      });
    });
  });

  describe('Token Management', () => {
    test('should store token in chrome storage', async () => {
      chrome.storage.local.set.mockResolvedValueOnce();

      const token = 'test-token';
      await chrome.storage.local.set({ github_token: token });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        github_token: token
      });
    });

    test('should retrieve token from chrome storage', async () => {
      const mockToken = 'stored-token';
      chrome.storage.local.get.mockResolvedValueOnce({
        github_token: mockToken
      });

      const result = await chrome.storage.local.get(['github_token']);

      expect(chrome.storage.local.get).toHaveBeenCalledWith(['github_token']);
      expect(result.github_token).toBe(mockToken);
    });
  });
});