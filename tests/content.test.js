// Content Script のテスト
// DOMの操作が含まれるため、jsdom環境でテスト

describe('Content Script', () => {
  let contentScript;

  beforeEach(() => {
    // DOMをリセット
    document.body.innerHTML = '';
    
    // content.jsの機能をシミュレート
    contentScript = {
      createSidebar: () => {
        const sidebar = document.createElement('div');
        sidebar.id = 'github-sidebar-container';
        sidebar.className = 'github-sidebar-container';
        return sidebar;
      },
      
      injectSidebar: () => {
        const existingSidebar = document.getElementById('github-sidebar-container');
        if (existingSidebar) {
          return existingSidebar;
        }
        
        const sidebar = contentScript.createSidebar();
        document.body.appendChild(sidebar);
        return sidebar;
      },
      
      removeSidebar: () => {
        const sidebar = document.getElementById('github-sidebar-container');
        if (sidebar) {
          sidebar.remove();
          return true;
        }
        return false;
      },
      
      toggleSidebar: () => {
        const sidebar = document.getElementById('github-sidebar-container');
        if (sidebar) {
          const isHidden = sidebar.style.display === 'none';
          sidebar.style.display = isHidden ? 'block' : 'none';
          return !isHidden;
        }
        return false;
      }
    };
  });

  describe('Sidebar Creation', () => {
    test('should create sidebar element', () => {
      const sidebar = contentScript.createSidebar();
      
      expect(sidebar.id).toBe('github-sidebar-container');
      expect(sidebar.className).toBe('github-sidebar-container');
      expect(sidebar.tagName).toBe('DIV');
    });

    test('should inject sidebar into page', () => {
      const sidebar = contentScript.injectSidebar();
      
      expect(document.getElementById('github-sidebar-container')).toBeTruthy();
      expect(document.body.contains(sidebar)).toBe(true);
    });

    test('should not create duplicate sidebar', () => {
      const sidebar1 = contentScript.injectSidebar();
      const sidebar2 = contentScript.injectSidebar();
      
      expect(sidebar1).toBe(sidebar2);
      expect(document.querySelectorAll('#github-sidebar-container').length).toBe(1);
    });

    test('should create sidebar only when needed', () => {
      // 初期状態ではサイドバーは存在しない
      expect(document.getElementById('github-sidebar-container')).toBeNull();
      
      // createSidebarを呼び出すとサイドバーが作成される
      const sidebar = contentScript.createSidebar();
      expect(sidebar).toBeTruthy();
      expect(sidebar.id).toBe('github-sidebar-container');
    });
  });

  describe('Sidebar Management', () => {
    test('should remove sidebar from page', () => {
      contentScript.injectSidebar();
      const removed = contentScript.removeSidebar();
      
      expect(removed).toBe(true);
      expect(document.getElementById('github-sidebar-container')).toBeNull();
    });

    test('should return false when removing non-existent sidebar', () => {
      const removed = contentScript.removeSidebar();
      expect(removed).toBe(false);
    });

    test('should toggle sidebar visibility', () => {
      const sidebar = contentScript.injectSidebar();
      
      // Initially visible
      expect(sidebar.style.display).not.toBe('none');
      
      // Hide sidebar
      const isHidden1 = contentScript.toggleSidebar();
      expect(isHidden1).toBe(true);
      expect(sidebar.style.display).toBe('none');
      
      // Show sidebar
      const isHidden2 = contentScript.toggleSidebar();
      expect(isHidden2).toBe(false);
      expect(sidebar.style.display).toBe('block');
    });
  });

  describe('GitHub Page Detection', () => {
    test('should detect GitHub repository page', () => {
      // GitHub repository URLのシミュレート
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'github.com',
          pathname: '/user/repo'
        },
        writable: true
      });

      const isGitHubRepo = () => {
        return window.location.hostname === 'github.com' && 
               window.location.pathname.split('/').length >= 3;
      };

      expect(isGitHubRepo()).toBe(true);
    });

    test('should not detect non-GitHub page', () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'example.com',
          pathname: '/page'
        },
        writable: true
      });

      const isGitHubRepo = () => {
        return window.location.hostname === 'github.com' && 
               window.location.pathname.split('/').length >= 3;
      };

      expect(isGitHubRepo()).toBe(false);
    });
  });

  describe('Message Handling', () => {
    test('should handle toggle sidebar message', () => {
      const messageHandler = (message, sender, sendResponse) => {
        switch (message.action) {
          case 'TOGGLE_SIDEBAR':
            const sidebar = contentScript.injectSidebar();
            const isHidden = contentScript.toggleSidebar();
            sendResponse({ success: true, hidden: isHidden });
            return true;
          default:
            sendResponse({ success: false, error: 'Unknown action' });
            return true;
        }
      };

      const mockSendResponse = jest.fn();
      messageHandler({ action: 'TOGGLE_SIDEBAR' }, null, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        hidden: expect.any(Boolean)
      });
    });

    test('should handle unknown message', () => {
      const messageHandler = (message, sender, sendResponse) => {
        switch (message.action) {
          case 'TOGGLE_SIDEBAR':
            const sidebar = contentScript.injectSidebar();
            const isHidden = contentScript.toggleSidebar();
            sendResponse({ success: true, hidden: isHidden });
            return true;
          default:
            sendResponse({ success: false, error: 'Unknown action' });
            return true;
        }
      };

      const mockSendResponse = jest.fn();
      messageHandler({ action: 'UNKNOWN_ACTION' }, null, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown action'
      });
    });
  });
});