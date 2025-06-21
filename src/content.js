// Content Script for GitHub Sidebar Extension
// Handles link interception and sidebar display for Issue/PR details

class GitHubSidebarContent {
  constructor() {
    this.sidebar = null;
    this.isVisible = false;
    this.currentRepo = null;
    this.currentItem = null; // 現在表示中のIssue/PR
    this.sidebarWidth = 400; // デフォルトのサイドバー幅
    this.minWidth = 300; // 最小幅
    this.maxWidth = 800; // 最大幅
    this.isResizing = false;
    
    this.init();
  }

  async init() {
    // GitHubページでのみ動作
    if (!this.isGitHubPage()) {
      return;
    }

    // 保存されたサイドバー幅を読み込み
    await this.loadSidebarWidth();

    this.setupMessageListener();
    this.detectRepository();
    this.setupNavigationListener();
    this.setupLinkInterception();
    this.injectLayoutStyles();
    
    // サイドバーは最初は作成しない（リンククリック時に作成）
  }

  injectLayoutStyles() {
    // GitHubページのレイアウトを調整するCSSを注入
    const style = document.createElement('style');
    style.id = 'github-sidebar-layout-styles';
    style.textContent = `
      /* GitHub Sidebar Layout Adjustments */
      .github-sidebar-split-layout .container-xl,
      .github-sidebar-split-layout .container-lg {
        max-width: none !important;
        width: calc(100% - ${this.sidebarWidth + 20}px) !important;
        margin-right: ${this.sidebarWidth + 20}px !important;
      }
      
      .github-sidebar-split-layout main {
        max-width: none !important;
        width: 100% !important;
      }
      
      .github-sidebar-active {
        overflow-x: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  isGitHubPage() {
    return window.location.hostname === 'github.com';
  }

  isRepositoryPage() {
    const pathParts = window.location.pathname.split('/').filter(part => part);
    return pathParts.length >= 2 && !pathParts[0].startsWith('_');
  }

  detectRepository() {
    if (!this.isRepositoryPage()) {
      this.currentRepo = null;
      return;
    }

    const pathParts = window.location.pathname.split('/').filter(part => part);
    this.currentRepo = {
      owner: pathParts[0],
      repo: pathParts[1]
    };
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // 非同期レスポンスを有効
    });
  }

  setupNavigationListener() {
    // GitHub SPAのナビゲーション監視
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.handleNavigation();
      }
      // 動的に追加されたリンクにもイベントを設定
      this.attachLinkListeners();
    }).observe(document, { subtree: true, childList: true });
  }

  setupLinkInterception() {
    // ページ読み込み完了後にリンクリスナーを設定
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.attachLinkListeners();
      });
    } else {
      this.attachLinkListeners();
    }
  }

  attachLinkListeners() {
    // Issue/PRへのリンクを検出してイベントリスナーを追加
    const links = document.querySelectorAll('a[href*="/issues/"], a[href*="/pull/"]');
    
    links.forEach(link => {
      // 既にリスナーが追加されている場合はスキップ
      if (link.hasAttribute('data-gh-sidebar-processed')) {
        return;
      }
      
      link.setAttribute('data-gh-sidebar-processed', 'true');
      link.addEventListener('click', (event) => {
        this.handleLinkClick(event);
      });
    });
  }

  handleLinkClick(event) {
    const link = event.target.closest('a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!this.isIssueOrPRLink(href)) return;
    
    // ページ遷移を防ぐ
    event.preventDefault();
    event.stopPropagation();
    
    // リンク情報を解析
    const linkInfo = this.parseLinkInfo(href);
    if (linkInfo) {
      this.openInSidebar(linkInfo);
    }
    
    return false;
  }

  isIssueOrPRLink(href) {
    if (!href) return false;
    return href.includes('/issues/') || href.includes('/pull/');
  }

  parseLinkInfo(href) {
    // 相対パスと絶対パスの両方に対応
    const match = href.match(/(?:https?:\/\/github\.com)?\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        type: match[3] === 'issues' ? 'issue' : 'pr',
        number: parseInt(match[4])
      };
    }
    return null;
  }

  async openInSidebar(linkInfo) {
    this.currentItem = linkInfo;
    
    // サイドバーが存在しない場合は作成
    if (!this.sidebar) {
      this.createSidebar();
    }
    
    // サイドバーを表示
    this.showSidebar();
    
    // Issue/PRのページをiframeで読み込み
    this.loadPageInSidebar(linkInfo);
  }

  handleNavigation() {
    const oldRepo = this.currentRepo;
    this.detectRepository();
    
    // リポジトリが変更された場合、サイドバーを更新
    if (JSON.stringify(oldRepo) !== JSON.stringify(this.currentRepo)) {
      if (this.sidebar && this.isVisible) {
        this.updateSidebarContent();
      }
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'TOGGLE_SIDEBAR':
        if (!this.sidebar) {
          sendResponse({ success: false, error: 'Sidebar not created yet. Click on an Issue or PR to create it.' });
        } else {
          this.toggleSidebar();
          sendResponse({ success: true, visible: this.isVisible });
        }
        break;
        
      case 'SHOW_SIDEBAR':
        if (!this.sidebar) {
          sendResponse({ success: false, error: 'Sidebar not created yet. Click on an Issue or PR to create it.' });
        } else {
          this.showSidebar();
          sendResponse({ success: true, visible: this.isVisible });
        }
        break;
        
      case 'HIDE_SIDEBAR':
        this.hideSidebar();
        sendResponse({ success: true, visible: this.isVisible });
        break;
        
      case 'GET_CURRENT_REPO':
        sendResponse({ success: true, repo: this.currentRepo });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  createSidebar() {
    if (this.sidebar) {
      return this.sidebar;
    }

    // サイドバーコンテナを作成
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'github-sidebar-container';
    this.sidebar.className = 'github-sidebar-container';
    this.updateSidebarStyles();

    // リサイズハンドルを追加
    this.createResizeHandle();
    
    // サイドバーのHTMLコンテンツを読み込み
    this.loadSidebarContent();

    // ページに追加
    document.body.appendChild(this.sidebar);
    
    return this.sidebar;
  }

  createResizeHandle() {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'gh-sidebar-resize-handle';
    resizeHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 5px;
      height: 100%;
      background: transparent;
      cursor: ew-resize;
      z-index: 10001;
      user-select: none;
    `;
    
    // マウスイベントを設定
    resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
    
    this.sidebar.appendChild(resizeHandle);
  }

  startResize(event) {
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.sidebarWidth;
    
    // ドキュメント全体にマウスイベントを追加
    document.addEventListener('mousemove', this.handleResize.bind(this));
    document.addEventListener('mouseup', this.stopResize.bind(this));
    
    // テキスト選択を無効化
    document.body.style.userSelect = 'none';
    
    event.preventDefault();
  }

  handleResize(event) {
    if (!this.isResizing) return;
    
    const deltaX = this.startX - event.clientX;
    const newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, this.startWidth + deltaX));
    
    if (newWidth !== this.sidebarWidth) {
      this.sidebarWidth = newWidth;
      this.updateSidebarStyles();
      this.updatePageLayout();
      
      // 幅をローカルストレージに保存
      this.saveSidebarWidth();
    }
  }

  stopResize() {
    this.isResizing = false;
    
    // イベントリスナーを削除
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    
    // テキスト選択を再有効化
    document.body.style.userSelect = '';
  }

  updateSidebarStyles() {
    if (!this.sidebar) return;
    
    this.sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: ${this.isVisible ? '0px' : `-${this.sidebarWidth}px`};
      width: ${this.sidebarWidth}px;
      height: 100vh;
      z-index: 10000;
      transition: ${this.isResizing ? 'none' : 'right 0.3s ease'};
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
      opacity: ${this.isVisible ? '1' : '0'};
      visibility: ${this.isVisible ? 'visible' : 'hidden'};
    `;
  }

  updatePageLayout() {
    if (!this.isVisible) return;
    
    // GitHubページのレイアウトを動的に調整
    const style = document.getElementById('github-sidebar-layout-styles');
    if (style) {
      style.textContent = `
        /* GitHub Sidebar Layout Adjustments */
        .github-sidebar-split-layout .container-xl,
        .github-sidebar-split-layout .container-lg {
          max-width: none !important;
          width: calc(100% - ${this.sidebarWidth + 20}px) !important;
          margin-right: ${this.sidebarWidth + 20}px !important;
        }
        
        .github-sidebar-split-layout main {
          max-width: none !important;
          width: 100% !important;
        }
        
        .github-sidebar-active {
          overflow-x: hidden;
        }
      `;
    }
  }

  async saveSidebarWidth() {
    try {
      await chrome.storage.local.set({ sidebar_width: this.sidebarWidth });
    } catch (error) {
      console.log('Failed to save sidebar width:', error);
    }
  }

  async loadSidebarWidth() {
    try {
      const result = await chrome.storage.local.get(['sidebar_width']);
      if (result.sidebar_width) {
        this.sidebarWidth = Math.max(this.minWidth, Math.min(this.maxWidth, result.sidebar_width));
      }
    } catch (error) {
      console.log('Failed to load sidebar width:', error);
    }
  }

  loadSidebarContent() {
    // sidebar.htmlの内容を動的に作成（iframe表示用）
    const sidebarContent = document.createElement('div');
    sidebarContent.innerHTML = `
      <div class="github-sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">GitHub</h2>
          <div class="sidebar-controls">
            <button id="gh-sidebar-back" class="icon-btn" title="Back">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"/>
              </svg>
            </button>
            <button id="gh-sidebar-refresh" class="icon-btn" title="Refresh">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/>
              </svg>
            </button>
            <button id="gh-sidebar-open-new" class="icon-btn" title="Open in new tab">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z"/>
              </svg>
            </button>
            <button id="gh-sidebar-close" class="icon-btn" title="Close">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="sidebar-content">
          <div id="gh-sidebar-content" class="content-area">
            <div id="gh-sidebar-loading" class="loading">
              <div class="spinner"></div>
              <span>Loading...</span>
            </div>
            <div id="gh-sidebar-issue-content" class="issue-content hidden">
              <!-- Issue/PRの内容がここに表示される -->
            </div>
            <div id="gh-sidebar-no-content" class="no-content">
              <p>Click on an Issue or Pull Request to view it here</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.sidebar.appendChild(sidebarContent);

    this.setupSidebarEvents();
  }

  setupSidebarEvents() {
    // 閉じるボタン
    const closeBtn = this.sidebar.querySelector('#gh-sidebar-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideSidebar());
    }

    // リフレッシュボタン
    const refreshBtn = this.sidebar.querySelector('#gh-sidebar-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshCurrentPage());
    }

    // 戻るボタン
    const backBtn = this.sidebar.querySelector('#gh-sidebar-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.goBack());
    }

    // 新しいタブで開くボタン
    const openNewBtn = this.sidebar.querySelector('#gh-sidebar-open-new');
    if (openNewBtn) {
      openNewBtn.addEventListener('click', () => this.openInNewTab());
    }
  }

  toggleSidebar() {
    if (this.isVisible) {
      this.hideSidebar();
    } else {
      this.showSidebar();
    }
  }

  showSidebar() {
    if (!this.sidebar) {
      return; // サイドバーが存在しない場合は何もしない
    }
    
    this.isVisible = true;
    
    // GitHubページのレイアウトを分割モードに変更
    document.body.classList.add('github-sidebar-split-layout', 'github-sidebar-active');
    
    this.updateSidebarStyles();
    this.updatePageLayout();
  }

  hideSidebar() {
    this.isVisible = false;
    
    if (this.sidebar) {
      this.updateSidebarStyles();
    }
    
    // GitHubページのレイアウトを通常モードに戻す
    document.body.classList.remove('github-sidebar-split-layout', 'github-sidebar-active');
  }

  toggleSidebar() {
    if (this.isVisible) {
      this.hideSidebar();
    } else {
      this.showSidebar();
    }
  }

  async loadPageInSidebar(linkInfo) {
    this.showLoading();
    this.hideNoContent();
    
    const pageUrl = `https://github.com/${linkInfo.owner}/${linkInfo.repo}/${linkInfo.type === 'issue' ? 'issues' : 'pull'}/${linkInfo.number}`;
    this.currentPageUrl = pageUrl;
    
    try {
      // 実際のGitHubページをフェッチして表示
      await this.fetchAndDisplayGithubPage(pageUrl);
      this.hideLoading();
      
    } catch (error) {
      console.log('GitHub page fetch failed:', error);
      this.hideLoading();
      this.showError('GitHubページの読み込みに失敗しました');
    }
  }

  async fetchAndDisplayGithubPage(pageUrl) {
    // Background Scriptに実際のページ取得を依頼
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'FETCH_GITHUB_PAGE', payload: { url: pageUrl } },
        (response) => {
          if (response.success) {
            this.displayGithubPageContent(response.content, pageUrl);
            resolve();
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  displayGithubPageContent(htmlContent, pageUrl) {
    const contentArea = this.sidebar.querySelector('#gh-sidebar-content');
    if (!contentArea) return;

    // 新しいコンテナを作成
    const pageContainer = document.createElement('div');
    pageContainer.id = 'gh-sidebar-page-content';
    pageContainer.className = 'github-page-content';
    
    // HTMLコンテンツをパース・サニタイズして表示
    const cleanedContent = this.sanitizeAndAdaptGithubContent(htmlContent, pageUrl);
    pageContainer.innerHTML = cleanedContent;
    
    // 既存のコンテンツを置き換え
    const existingContent = contentArea.querySelector('#gh-sidebar-page-content');
    if (existingContent) {
      contentArea.removeChild(existingContent);
    }
    contentArea.appendChild(pageContainer);
    
    // GitHubページ内のリンクを処理
    this.processPageLinks(pageContainer);
  }

  sanitizeAndAdaptGithubContent(htmlContent, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // メインコンテンツ部分を抽出（GitHub特有のセレクタを使用）
    const mainContent = doc.querySelector('main, [role="main"], .js-repo-pjax-container');
    if (!mainContent) {
      throw new Error('GitHubのメインコンテンツが見つかりませんでした');
    }
    
    // 不要な要素を削除
    const elementsToRemove = [
      '.Header', '.footer', '.js-header-wrapper',
      '.subnav', '.pagehead', '.file-navigation',
      '.js-notification-shelf', '.js-flash-container'
    ];
    
    elementsToRemove.forEach(selector => {
      const elements = mainContent.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // サイドバー表示に適したスタイルを追加
    mainContent.style.cssText = `
      width: 100% !important;
      max-width: none !important;
      padding: 16px !important;
      margin: 0 !important;
      font-size: 13px !important;
    `;
    
    // 相対URLを絶対URLに変換
    this.convertRelativeUrls(mainContent, baseUrl);
    
    return mainContent.outerHTML;
  }

  convertRelativeUrls(element, baseUrl) {
    const base = new URL(baseUrl);
    
    // リンクを変換
    element.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('/')) {
        link.setAttribute('href', `${base.origin}${href}`);
      }
    });
    
    // 画像を変換
    element.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('/')) {
        img.setAttribute('src', `${base.origin}${src}`);
      }
    });
  }

  processPageLinks(container) {
    // サイドバー内のリンククリックを処理
    container.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // GitHub内のIssue/PRリンクの場合はサイドバー内で開く
      if (this.isIssueOrPRLink(href)) {
        event.preventDefault();
        const linkInfo = this.parseLinkInfo(href);
        if (linkInfo) {
          this.loadPageInSidebar(linkInfo);
        }
      } else if (href.startsWith('https://github.com')) {
        // その他のGitHubリンクは新しいタブで開く
        event.preventDefault();
        window.open(href, '_blank');
      }
    });
  }

  async getStoredToken() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_TOKEN' }, (response) => {
        resolve(response?.token || null);
      });
    });
  }


  refreshCurrentPage() {
    const iframe = this.sidebar.querySelector('#gh-sidebar-iframe');
    if (iframe && iframe.src) {
      this.showLoading();
      iframe.classList.add('hidden');
      iframe.src = iframe.src; // iframeをリロード
    }
  }

  goBack() {
    const iframe = this.sidebar.querySelector('#gh-sidebar-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.history.back();
      } catch (error) {
        console.log('Cannot go back in iframe:', error);
        // フォールバック: サイドバーを閉じる
        this.hideSidebar();
      }
    }
  }

  openInNewTab() {
    if (this.currentPageUrl) {
      window.open(this.currentPageUrl, '_blank');
    }
  }

  requestData(action, payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, payload }, resolve);
    });
  }


  showLoading() {
    const loading = this.sidebar.querySelector('#gh-sidebar-loading');
    if (loading) {
      loading.style.display = 'flex';
    }
  }

  hideLoading() {
    const loading = this.sidebar.querySelector('#gh-sidebar-loading');
    if (loading) {
      loading.style.display = 'none';
    }
  }

  showError(message) {
    this.hideLoading();
    const contentArea = this.sidebar.querySelector('#gh-sidebar-content');
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="error-message">
          <p>Error: ${message}</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  hideNoContent() {
    const noContent = this.sidebar.querySelector('#gh-sidebar-no-content');
    if (noContent) {
      noContent.style.display = 'none';
    }
  }

  showNoContent() {
    const noContent = this.sidebar.querySelector('#gh-sidebar-no-content');
    if (noContent) {
      noContent.style.display = 'block';
    }
    
    // 他のコンテンツを隠す
    const itemContent = this.sidebar.querySelector('#gh-sidebar-item-content');
    const comments = this.sidebar.querySelector('#gh-sidebar-comments');
    
    if (itemContent) itemContent.classList.add('hidden');
    if (comments) comments.classList.add('hidden');
  }

}

// Content script initialization
if (typeof window !== 'undefined') {
  new GitHubSidebarContent();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubSidebarContent;
}