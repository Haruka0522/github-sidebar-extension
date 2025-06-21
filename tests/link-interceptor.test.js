// Issue/PRリンクのインターセプト機能のテスト

describe('Link Interceptor', () => {
  let interceptor;
  let mockCallback;

  beforeEach(() => {
    // DOMをリセット
    document.body.innerHTML = '';
    mockCallback = jest.fn();
    
    // LinkInterceptor のモック
    interceptor = {
      init: () => {
        interceptor.attachLinkListeners();
      },
      
      attachLinkListeners: () => {
        const links = document.querySelectorAll('a[href*="/issues/"], a[href*="/pull/"]');
        links.forEach(link => {
          link.addEventListener('click', interceptor.handleLinkClick);
        });
      },
      
      handleLinkClick: (event) => {
        const href = event.target.getAttribute('href');
        if (interceptor.isIssueOrPRLink(href)) {
          event.preventDefault();
          event.stopPropagation();
          const info = interceptor.parseLinkInfo(href);
          mockCallback(info);
          return false;
        }
      },
      
      isIssueOrPRLink: (href) => {
        return href && (href.includes('/issues/') || href.includes('/pull/'));
      },
      
      parseLinkInfo: (href) => {
        const match = href.match(/\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/);
        if (match) {
          return {
            owner: match[1],
            repo: match[2],
            type: match[3],
            number: parseInt(match[4])
          };
        }
        return null;
      }
    };
  });

  describe('Link Detection', () => {
    test('should detect issue links', () => {
      const href = '/user/repo/issues/123';
      expect(interceptor.isIssueOrPRLink(href)).toBe(true);
    });

    test('should detect PR links', () => {
      const href = '/user/repo/pull/456';
      expect(interceptor.isIssueOrPRLink(href)).toBe(true);
    });

    test('should not detect non-issue/PR links', () => {
      const href = '/user/repo/blob/main/README.md';
      expect(interceptor.isIssueOrPRLink(href)).toBe(false);
    });

    test('should handle absolute URLs', () => {
      const href = 'https://github.com/user/repo/issues/789';
      expect(interceptor.isIssueOrPRLink(href)).toBe(true);
    });
  });

  describe('Link Parsing', () => {
    test('should parse issue link correctly', () => {
      const href = '/microsoft/vscode/issues/123';
      const info = interceptor.parseLinkInfo(href);
      
      expect(info).toEqual({
        owner: 'microsoft',
        repo: 'vscode',
        type: 'issues',
        number: 123
      });
    });

    test('should parse PR link correctly', () => {
      const href = '/facebook/react/pull/456';
      const info = interceptor.parseLinkInfo(href);
      
      expect(info).toEqual({
        owner: 'facebook',
        repo: 'react',
        type: 'pull',
        number: 456
      });
    });

    test('should handle absolute URLs', () => {
      const href = 'https://github.com/nodejs/node/issues/789';
      const info = interceptor.parseLinkInfo(href);
      
      expect(info).toEqual({
        owner: 'nodejs',
        repo: 'node',
        type: 'issues',
        number: 789
      });
    });

    test('should return null for invalid links', () => {
      const href = '/user/repo/blob/main/file.js';
      const info = interceptor.parseLinkInfo(href);
      expect(info).toBeNull();
    });
  });

  describe('Click Interception', () => {
    test('should intercept issue link clicks', () => {
      // Issue リンクを作成
      const link = document.createElement('a');
      link.href = '/user/repo/issues/123';
      link.textContent = 'Test Issue #123';
      document.body.appendChild(link);

      // リスナーをアタッチ
      interceptor.init();

      // クリックイベントを作成してディスパッチ
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });

      // preventDefault と stopPropagation をモック
      clickEvent.preventDefault = jest.fn();
      clickEvent.stopPropagation = jest.fn();

      link.dispatchEvent(clickEvent);

      // コールバックが呼ばれることを確認
      expect(mockCallback).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        type: 'issues',
        number: 123
      });

      // イベントが防がれることを確認
      expect(clickEvent.preventDefault).toHaveBeenCalled();
      expect(clickEvent.stopPropagation).toHaveBeenCalled();
    });

    test('should intercept PR link clicks', () => {
      const link = document.createElement('a');
      link.href = '/user/repo/pull/456';
      link.textContent = 'Test PR #456';
      document.body.appendChild(link);

      interceptor.init();

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });

      clickEvent.preventDefault = jest.fn();
      clickEvent.stopPropagation = jest.fn();

      link.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        type: 'pull',
        number: 456
      });
    });

    test('should not intercept non-issue/PR links', () => {
      const link = document.createElement('a');
      link.href = '/user/repo/blob/main/README.md';
      link.textContent = 'README';
      document.body.appendChild(link);

      interceptor.init();

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });

      clickEvent.preventDefault = jest.fn();

      link.dispatchEvent(clickEvent);

      // コールバックが呼ばれないことを確認
      expect(mockCallback).not.toHaveBeenCalled();
      expect(clickEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Dynamic Content Support', () => {
    test('should handle dynamically added links', () => {
      // 初期化
      interceptor.init();

      // 動的にリンクを追加
      const link = document.createElement('a');
      link.href = '/user/repo/issues/999';
      link.textContent = 'Dynamic Issue #999';
      document.body.appendChild(link);

      // MutationObserver のシミュレート
      interceptor.attachLinkListeners();

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true
      });

      clickEvent.preventDefault = jest.fn();
      clickEvent.stopPropagation = jest.fn();

      link.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        type: 'issues',
        number: 999
      });
    });
  });
});