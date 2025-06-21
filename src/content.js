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
    this.lastResizeTime = 0;
    this.resizeAnimationFrame = null;
    
    // iframeスタイル更新の最適化されたデバウンス関数
    this.debouncedUpdateIframeStyles = this.debounce(() => {
      this.updateIframeStyles();
    }, 50); // 遅延を短く
    
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
    this.setupIframeMessageListener();
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

  setupIframeMessageListener() {
    // iframe内からのメッセージを受信
    window.addEventListener('message', (event) => {
      if (event.origin !== 'https://github.com') return;
      
      if (event.data.type === 'NAVIGATE_SIDEBAR') {
        const linkInfo = event.data.linkInfo;
        if (linkInfo) {
          console.log('Navigating sidebar to:', linkInfo);
          this.loadPageInSidebar(linkInfo);
        }
      }
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
    const linkSelectors = [
      'a[href*="/issues/"]',
      'a[href*="/pull/"]',
      'a[data-hovercard-type="issue"]',
      'a[data-hovercard-type="pull_request"]',
      '.js-issue-row a',
      '.js-navigation-item a'
    ];
    
    const links = document.querySelectorAll(linkSelectors.join(', '));
    
    links.forEach(link => {
      // 既にリスナーが追加されている場合はスキップ
      if (link.hasAttribute('data-gh-sidebar-processed')) {
        return;
      }
      
      const href = link.getAttribute('href');
      if (this.isIssueOrPRLink(href)) {
        link.setAttribute('data-gh-sidebar-processed', 'true');
        link.addEventListener('click', (event) => {
          this.handleLinkClick(event);
        });
      }
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
    return href.includes('/issues/') || href.includes('/pull/') || href.match(/\/pull\/\d+/);
  }

  parseLinkInfo(href) {
    // 相対パスと絶対パスの両方に対応、PRのpullパスも対応
    const match = href.match(/(?:https?:\/\/github\.com)?\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        type: match[3] === 'issues' ? 'issue' : 'pr',
        number: parseInt(match[4])
      };
    }
    
    // GitHub URLのクエリパラメータやアンカーを含む場合の処理
    const cleanHref = href.split('?')[0].split('#')[0];
    const matchClean = cleanHref.match(/(?:https?:\/\/github\.com)?\/([^\/]+)\/([^\/]+)\/(issues|pull)\/(\d+)/);
    if (matchClean) {
      return {
        owner: matchClean[1],
        repo: matchClean[2],
        type: matchClean[3] === 'issues' ? 'issue' : 'pr',
        number: parseInt(matchClean[4])
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
      left: -3px;
      top: 0;
      width: 8px;
      height: 100%;
      background: transparent;
      cursor: ew-resize;
      z-index: 10001;
      user-select: none;
      border-left: 2px solid transparent;
      transition: border-color 0.2s ease;
    `;
    
    // ホバー効果
    resizeHandle.addEventListener('mouseenter', () => {
      resizeHandle.style.borderLeftColor = 'rgba(9, 105, 218, 0.5)';
    });
    
    resizeHandle.addEventListener('mouseleave', () => {
      if (!this.isResizing) {
        resizeHandle.style.borderLeftColor = 'transparent';
      }
    });
    
    // マウスイベントを設定
    resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
    
    this.sidebar.appendChild(resizeHandle);
  }

  startResize(event) {
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.sidebarWidth;
    this.lastResizeTime = 0;
    
    // リサイズ中のビジュアルフィードバック
    const resizeHandle = event.target;
    resizeHandle.style.borderLeftColor = 'rgba(9, 105, 218, 0.8)';
    document.body.style.cursor = 'ew-resize';
    
    // ドキュメント全体にマウスイベントを追加
    document.addEventListener('mousemove', this.handleResize.bind(this));
    document.addEventListener('mouseup', this.stopResize.bind(this));
    
    // テキスト選択とコンテキストメニューを無効化
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none';
    this.sidebar.style.pointerEvents = 'auto';
    
    event.preventDefault();
    event.stopPropagation();
  }

  handleResize(event) {
    if (!this.isResizing) return;
    
    const now = Date.now();
    if (now - this.lastResizeTime < 16) return; // 60fps制限
    this.lastResizeTime = now;
    
    const deltaX = this.startX - event.clientX;
    const newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, this.startWidth + deltaX));
    
    if (Math.abs(newWidth - this.sidebarWidth) > 2) { // 2px以上の変化のみ処理
      this.sidebarWidth = newWidth;
      
      // UI更新をrequestAnimationFrameで最適化
      if (this.resizeAnimationFrame) {
        cancelAnimationFrame(this.resizeAnimationFrame);
      }
      
      this.resizeAnimationFrame = requestAnimationFrame(() => {
        this.updateSidebarStyles();
        this.updatePageLayout();
        
        // iframeスタイル更新はデバウンスで最適化
        this.debouncedUpdateIframeStyles();
      });
    }
  }

  stopResize() {
    this.isResizing = false;
    
    // イベントリスナーを削除
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    
    // UI状態を復元
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.body.style.pointerEvents = '';
    this.sidebar.style.pointerEvents = '';
    
    // リサイズハンドルの色を復元
    const resizeHandle = this.sidebar.querySelector('.gh-sidebar-resize-handle');
    if (resizeHandle) {
      resizeHandle.style.borderLeftColor = 'transparent';
    }
    
    // アニメーションフレームをキャンセル
    if (this.resizeAnimationFrame) {
      cancelAnimationFrame(this.resizeAnimationFrame);
      this.resizeAnimationFrame = null;
    }
    
    // 最終的なスタイル適用と保存
    setTimeout(() => {
      this.updateIframeStyles();
      this.saveSidebarWidth();
    }, 50);
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

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    }.bind(this);
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
    
    // iframe内のスタイルも更新
    setTimeout(() => {
      this.updateIframeStyles();
    }, 200);
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
      // iframeでGitHubページを読み込み
      await this.loadPageInIframe(pageUrl);
      this.hideLoading();
      
    } catch (error) {
      console.log('iframe load failed, falling back to static content:', error);
      try {
        // フォールバック: 静的コンテンツ表示
        await this.fetchAndDisplayGithubPage(pageUrl);
        this.hideLoading();
        this.enhanceStaticContent(linkInfo);
      } catch (fallbackError) {
        this.hideLoading();
        this.showError('GitHubページの読み込みに失敗しました');
      }
    }
  }


  async loadPageInIframe(pageUrl) {
    // iframeでGitHubページを読み込み
    const contentArea = this.sidebar.querySelector('#gh-sidebar-content');
    if (!contentArea) return;

    // 既存のコンテンツをクリア
    const existingContent = contentArea.querySelector('#gh-sidebar-page-content');
    if (existingContent) {
      contentArea.removeChild(existingContent);
    }

    // iframeコンテナを作成
    const iframeContainer = document.createElement('div');
    iframeContainer.id = 'gh-sidebar-page-content';
    iframeContainer.className = 'github-page-content';
    
    // iframeを作成
    const iframe = document.createElement('iframe');
    iframe.className = 'sidebar-iframe';
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
      display: block;
      margin: 0;
      padding: 0;
    `;
    
    // iframeのURLを設定
    iframe.src = pageUrl;
    
    // iframe読み込みイベントを監視
    return new Promise((resolve, reject) => {
      iframe.addEventListener('load', () => {
        console.log('GitHub page loaded successfully in iframe');
        this.setupIframeInteraction(iframe);
        // 読み込み後にスタイルを再適用
        setTimeout(() => {
          this.updateIframeStyles();
        }, 500);
        resolve();
      });
      
      iframe.addEventListener('error', () => {
        console.log('iframe failed to load');
        reject(new Error('iframe loading failed'));
      });
      
      // タイムアウトでエラーとする
      setTimeout(() => {
        reject(new Error('iframe loading timeout'));
      }, 10000);
      
      iframeContainer.appendChild(iframe);
      contentArea.appendChild(iframeContainer);
    });
  }

  setupIframeInteraction(iframe) {
    try {
      // iframe内のGitHubページとの相互作用を設定
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // DOM読み込み完了を待ってからスタイル調整
      if (iframeDoc.readyState === 'loading') {
        iframeDoc.addEventListener('DOMContentLoaded', () => {
          this.adjustIframeStyles(iframeDoc);
          this.setupIframeLinkHandling(iframeDoc);
        });
      } else {
        // 既に読み込み完了している場合
        setTimeout(() => {
          this.adjustIframeStyles(iframeDoc);
          this.setupIframeLinkHandling(iframeDoc);
        }, 100);
      }
      
      // サイドバーの幅変更を監視してiframeスタイルを更新
      const observer = new MutationObserver(() => {
        this.adjustIframeStyles(iframeDoc);
      });
      
      // サイドバーのスタイル変更を監視
      if (this.sidebar) {
        observer.observe(this.sidebar, {
          attributes: true,
          attributeFilter: ['style']
        });
      }
      
      // 追加のスタイル調整を定期的に実行（GitHub SPAの動的読み込み対応）
      const styleInterval = setInterval(() => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          if (doc && doc.body) {
            this.adjustIframeStyles(doc);
          }
        } catch (e) {
          clearInterval(styleInterval);
        }
      }, 1000);
      
      // 10秒後にインターバルを停止
      setTimeout(() => {
        clearInterval(styleInterval);
      }, 10000);
      
      console.log('iframe interaction setup completed');
      
    } catch (error) {
      console.log('Cannot access iframe content due to CORS:', error);
      // CORS制限によりアクセスできない場合は何もしない
    }
  }

  updateIframeStyles() {
    // 現在表示中のiframeのスタイルを更新
    const iframe = this.sidebar?.querySelector('.sidebar-iframe');
    if (!iframe) return;
    
    // iframe自体のサイズを更新（スムーズなアニメーション）
    iframe.style.transition = 'width 0.1s ease-out';
    iframe.style.width = this.sidebarWidth + 'px';
    iframe.style.maxWidth = this.sidebarWidth + 'px';
    iframe.style.minWidth = this.sidebarWidth + 'px';
    
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc && iframeDoc.readyState === 'complete') {
        // パフォーマンスを最適化したスタイル適用
        this.optimizedAdjustIframeStyles(iframeDoc);
      }
    } catch (error) {
      // CORS制限の場合は無視
    }
  }

  optimizedAdjustIframeStyles(iframeDoc) {
    // パフォーマンス最適化されたスタイル適用
    const styleId = 'github-sidebar-custom-styles';
    let style = iframeDoc.querySelector(`#${styleId}`);
    
    if (!style) {
      style = iframeDoc.createElement('style');
      style.id = styleId;
      iframeDoc.head.appendChild(style);
    }
    
    // サイドバー幅に基づいた最適化されたスタイル
    const containerWidth = this.sidebarWidth - 16;
    const contentWidth = this.sidebarWidth - 20;
    
    style.textContent = `
      /* ヘッダー、フッター、ナビゲーションを非表示 */
      .Header, .footer, .js-header-wrapper { display: none !important; }
      .subnav, .pagehead, .BorderGrid-row .BorderGrid-cell:first-child { display: none !important; }
      .js-notification-shelf, .js-flash-container { display: none !important; }
      
      /* ボディとメインコンテナの幅調整 */
      html, body {
        width: ${this.sidebarWidth}px !important;
        max-width: ${this.sidebarWidth}px !important;
        min-width: ${this.sidebarWidth}px !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow-x: hidden !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      }
      
      /* メインコンテナの幅調整 */
      .container-xl, .container-lg, .container-md, .container {
        max-width: ${containerWidth}px !important;
        width: ${containerWidth}px !important;
        min-width: ${containerWidth}px !important;
        padding: 8px !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
      }
      
      /* レイアウト調整 */
      .Layout, .Layout-main, .Layout-content {
        width: ${this.sidebarWidth}px !important;
        max-width: ${this.sidebarWidth}px !important;
        min-width: ${this.sidebarWidth}px !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      
      /* サイドバー要素を非表示 */
      .Layout-sidebar, .sidebar-component {
        display: none !important;
      }
      
      /* グリッドレイアウト調整 */
      .gutter-condensed, .gutter-spacious {
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      
      /* フォントサイズ調整 */
      body { font-size: 13px !important; line-height: 1.4 !important; }
      
      /* タイムライン調整 */
      .timeline-comment { margin-bottom: 8px !important; }
      .timeline-comment-header { padding: 6px 8px !important; font-size: 11px !important; }
      .comment-body { padding: 8px !important; font-size: 12px !important; }
      
      /* マークダウン調整 */
      .markdown-body {
        font-size: 12px !important;
        line-height: 1.4 !important;
      }
      
      .markdown-body h1, .markdown-body h2, .markdown-body h3 {
        font-size: 14px !important;
        margin: 8px 0 4px 0 !important;
      }
      
      .markdown-body p {
        margin: 6px 0 !important;
      }
      
      .markdown-body pre {
        font-size: 10px !important;
        padding: 6px !important;
        overflow-x: auto !important;
      }
      
      /* ボタン、フォーム調整 */
      .btn { font-size: 11px !important; padding: 4px 8px !important; }
      
      /* テーブル調整 */
      table { font-size: 11px !important; }
      
      /* 幅が固定された要素の調整 */
      [style*="width:"] {
        width: auto !important;
        max-width: ${containerWidth}px !important;
      }
      
      .width-full {
        width: ${containerWidth}px !important;
        max-width: ${containerWidth}px !important;
      }
      
      /* コンテンツの最大幅制限 */
      * {
        max-width: ${this.sidebarWidth}px !important;
        box-sizing: border-box !important;
      }
      
      /* スクロール可能要素の調整 */
      .overflow-auto, .overflow-x-auto {
        max-width: ${contentWidth}px !important;
      }
      
      /* 強制的な幅制限 */
      #js-repo-pjax-container,
      .application-main,
      [data-turbo-body] {
        width: ${this.sidebarWidth}px !important;
        max-width: ${this.sidebarWidth}px !important;
        overflow-x: hidden !important;
      }
      
      /* フレックスレイアウト調整 */
      .d-flex {
        flex-wrap: wrap !important;
      }
      
      /* PR固有の要素調整 */
      .pr-toolbar, .pull-request-tab-content {
        width: ${containerWidth}px !important;
        max-width: ${containerWidth}px !important;
        margin: 0 !important;
        padding: 6px !important;
        box-sizing: border-box !important;
      }
      
      .diffbar {
        font-size: 10px !important;
        padding: 4px 6px !important;
      }
      
      .file-header {
        font-size: 10px !important;
        padding: 4px 6px !important;
      }
      
      .diff-table {
        font-size: 10px !important;
        line-height: 1.2 !important;
        overflow-x: auto !important;
        max-width: ${contentWidth}px !important;
        width: ${contentWidth}px !important;
      }
      
      .blob-code {
        font-size: 9px !important;
        padding: 0 4px !important;
        line-height: 1.2 !important;
        white-space: pre-wrap !important;
        word-break: break-all !important;
      }
      
      .blob-code-inner {
        max-width: 100% !important;
        overflow-wrap: break-word !important;
        word-break: break-all !important;
      }
      
      /* スクロールバー調整 */
      ::-webkit-scrollbar {
        width: 6px !important;
        height: 6px !important;
      }
      
      ::-webkit-scrollbar-track {
        background: #f1f1f1 !important;
      }
      
      ::-webkit-scrollbar-thumb {
        background: #c1c1c1 !important;
        border-radius: 3px !important;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8 !important;
      }
    `;
    
    // 重要な要素のみ直接スタイル適用（パフォーマンス最適化）
    this.quickResizeElements(iframeDoc);
  }
  
  quickResizeElements(iframeDoc) {
    // 最も重要な要素のみ素早くリサイズ
    const criticalSelectors = ['html', 'body', '.container-xl', '.container-lg'];
    
    criticalSelectors.forEach(selector => {
      const elements = iframeDoc.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.setProperty('width', this.sidebarWidth + 'px', 'important');
        el.style.setProperty('max-width', this.sidebarWidth + 'px', 'important');
        el.style.setProperty('overflow-x', 'hidden', 'important');
      });
    });
  }
  
  // 既存のadjustIframeStylesメソッドを保持（互換性のため）
  adjustIframeStyles(iframeDoc) {
    this.optimizedAdjustIframeStyles(iframeDoc);
  }
  
  forceIframeResize(iframeDoc) {
    // 強制的にサイズを再設定
    const elementsToResize = [
      'html', 'body', '.container-xl', '.container-lg', '.container-md', '.container',
      '.Layout', '.Layout-main', '.Layout-content', '#js-repo-pjax-container',
      '.application-main', '[data-turbo-body]'
    ];
    
    elementsToResize.forEach(selector => {
      const elements = iframeDoc.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.setProperty('width', this.sidebarWidth + 'px', 'important');
        el.style.setProperty('max-width', this.sidebarWidth + 'px', 'important');
        el.style.setProperty('min-width', this.sidebarWidth + 'px', 'important');
        el.style.setProperty('overflow-x', 'hidden', 'important');
        el.style.setProperty('box-sizing', 'border-box', 'important');
      });
    });
    
    // 特定の幅制限を持つ要素を強制的に調整
    const wideElements = iframeDoc.querySelectorAll('[style*="width"]');
    wideElements.forEach(el => {
      const currentWidth = parseInt(el.style.width);
      if (currentWidth > this.sidebarWidth) {
        el.style.setProperty('width', 'auto', 'important');
        el.style.setProperty('max-width', this.sidebarWidth + 'px', 'important');
      }
    });
    
    // ビューポートの設定
    let viewport = iframeDoc.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', `width=${this.sidebarWidth}, initial-scale=1.0`);
    } else {
      viewport = iframeDoc.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = `width=${this.sidebarWidth}, initial-scale=1.0`;
      iframeDoc.head.appendChild(viewport);
    }
    
    console.log('Forced iframe resize completed for width:', this.sidebarWidth);
  }

  setupIframeLinkHandling(iframeDoc) {
    // iframe内のリンククリックを処理
    iframeDoc.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // GitHub内のIssue/PRリンクの場合はサイドバー内で開く
      if (this.isIssueOrPRLink(href)) {
        event.preventDefault();
        const linkInfo = this.parseLinkInfo(href);
        if (linkInfo) {
          // 親ウィンドウにメッセージを送信
          window.parent.postMessage({
            type: 'NAVIGATE_SIDEBAR',
            linkInfo: linkInfo
          }, '*');
        }
      } else if (link.target === '_blank' || event.ctrlKey || event.metaKey) {
        // 新しいタブで開くリンクはそのまま處理
        return;
      } else if (href.startsWith('https://github.com') || href.startsWith('/')) {
        // その他のGitHubリンクは新しいタブで開く
        event.preventDefault();
        const fullUrl = href.startsWith('/') ? `https://github.com${href}` : href;
        window.open(fullUrl, '_blank');
      }
    });
  }

  async fetchAndDisplayGithubPage(pageUrl) {
    // フォールバック: 静的コンテンツ表示（既存の実装）
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
    
    return pageContainer;
  }

  sanitizeAndAdaptGithubContent(htmlContent, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Issue/PR固有のコンテンツ部分を抽出
    let mainContent = this.findIssueOrPRContent(doc);
    
    if (!mainContent) {
      // フォールバック: より一般的なセレクタを試行
      mainContent = doc.querySelector('main, [role="main"], .js-repo-pjax-container, #js-repo-pjax-container');
    }
    
    if (!mainContent) {
      throw new Error('GitHubのメインコンテンツが見つかりませんでした');
    }
    
    // 不要な要素を削除
    this.removeUnwantedElements(mainContent);
    
    // サイドバー表示に適したスタイルを追加
    this.applySidebarStyles(mainContent);
    
    // 相対URLを絶対URLに変換
    this.convertRelativeUrls(mainContent, baseUrl);
    
    return mainContent.outerHTML;
  }

  findIssueOrPRContent(doc) {
    // Issue/PR専用のセレクタを順番に試行
    const selectors = [
      // Issue/PRの詳細ページ
      '.js-issues-results, .js-issues-container',
      '.repository-content',
      '.container-xl .gutter-condensed',
      '.container-lg .gutter-condensed',
      // PR固有
      '.pull-request-tab-content',
      '.js-pull-request-tab',
      '.pr-toolbar',
      // Issue固有
      '.js-issue-title',
      '.js-issue-row',
      // 一般的な
      '.js-repo-pjax-container',
      'main[role="main"]',
      'main',
      '#js-repo-pjax-container'
    ];
    
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        console.log(`Found content with selector: ${selector}`);
        return element;
      }
    }
    
    return null;
  }

  removeUnwantedElements(mainContent) {
    const elementsToRemove = [
      // ヘッダー・ナビゲーション
      '.Header', '.footer', '.js-header-wrapper',
      '.subnav', '.pagehead', '.file-navigation',
      '.js-notification-shelf', '.js-flash-container',
      // サイドバー要素
      '.Layout-sidebar', '.sidebar-component',
      // 広告・プロモーション
      '.js-notice', '.flash-notice', '.flash-error',
      // ナビゲーションバー
      '.js-sticky', '.sticky',
      // ファイルビューア関連
      '.file-header', '.file-actions',
      // その他不要な要素
      '.js-site-search-form', '.js-global-search-form'
    ];
    
    elementsToRemove.forEach(selector => {
      const elements = mainContent.querySelectorAll(selector);
      elements.forEach(el => {
        console.log(`Removing element: ${selector}`);
        el.remove();
      });
    });
  }

  applySidebarStyles(mainContent) {
    // コンテナ全体のスタイル
    mainContent.style.cssText = `
      width: 100% !important;
      max-width: none !important;
      padding: 12px !important;
      margin: 0 !important;
      font-size: 13px !important;
      line-height: 1.4 !important;
      box-sizing: border-box !important;
    `;
    
    // 内部要素のスタイル調整
    const elementsToStyle = [
      { selector: '.container-xl, .container-lg', styles: 'max-width: none !important; width: 100% !important; padding: 0 !important; margin: 0 !important;' },
      { selector: '.Layout-main', styles: 'width: 100% !important; max-width: none !important;' },
      { selector: '.Layout-content', styles: 'width: 100% !important; max-width: none !important;' },
      { selector: '.timeline-comment', styles: 'margin-bottom: 8px !important;' },
      { selector: '.timeline-comment-header', styles: 'padding: 6px 8px !important; font-size: 11px !important;' },
      { selector: '.comment-body', styles: 'padding: 8px !important; font-size: 12px !important;' },
      { selector: '.markdown-body', styles: 'font-size: 12px !important; line-height: 1.4 !important;' },
      { selector: '.markdown-body h1, .markdown-body h2, .markdown-body h3', styles: 'font-size: 14px !important; margin: 8px 0 4px 0 !important;' },
      { selector: '.btn', styles: 'font-size: 11px !important; padding: 3px 6px !important;' },
      { selector: 'table', styles: 'font-size: 11px !important;' },
      { selector: 'pre, code', styles: 'font-size: 10px !important;' }
    ];
    
    elementsToStyle.forEach(({ selector, styles }) => {
      const elements = mainContent.querySelectorAll(selector);
      elements.forEach(el => {
        el.style.cssText += styles;
      });
    });
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
          console.log('Opening in sidebar:', linkInfo);
          this.loadPageInSidebar(linkInfo);
        }
      } else if (href && (href.startsWith('https://github.com') || href.startsWith('/') && !href.startsWith('//'))) {
        // その他のGitHubリンクは新しいタブで開く
        event.preventDefault();
        const fullUrl = href.startsWith('/') ? `https://github.com${href}` : href;
        window.open(fullUrl, '_blank');
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

  enhanceStaticContent(linkInfo) {
    // 静的コンテンツにインタラクティブな機能を追加
    const pageContainer = this.sidebar.querySelector('#gh-sidebar-page-content');
    if (!pageContainer) return;
    
    // アクションバーを追加
    this.addActionBar(pageContainer, linkInfo);
    
    // ボタンに機能を追加
    this.enhanceButtons(pageContainer, linkInfo);
    
    // フォームを機能させる
    this.enhanceForms(pageContainer, linkInfo);
  }
  
  addActionBar(container, linkInfo) {
    const actionBar = document.createElement('div');
    actionBar.className = 'sidebar-action-bar';
    actionBar.style.cssText = `
      background: #f6f8fa;
      border-bottom: 1px solid #d1d9e0;
      padding: 8px 12px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    actionBar.innerHTML = `
      <span style="color: #656d76;">
        📝 ${linkInfo.type === 'issue' ? 'Issue' : 'PR'} #${linkInfo.number} (読み取り専用)
      </span>
      <div>
        <button id="refresh-sidebar" style="background: #f3f4f6; border: 1px solid #d1d9e0; padding: 4px 8px; margin-right: 4px; border-radius: 3px; font-size: 11px; cursor: pointer;">更新</button>
        <button id="open-full-page" style="background: #0969da; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 11px; cursor: pointer;">新しいタブで開く</button>
      </div>
    `;
    
    // ボタンのイベントリスナー
    actionBar.querySelector('#refresh-sidebar').addEventListener('click', () => {
      this.loadPageInSidebar(linkInfo);
    });
    
    actionBar.querySelector('#open-full-page').addEventListener('click', () => {
      window.open(this.currentPageUrl, '_blank');
    });
    
    container.insertBefore(actionBar, container.firstChild);
  }
  
  enhanceButtons(container, linkInfo) {
    // コメントボタン、反応ボタンなどを探して機能を追加
    const buttons = container.querySelectorAll('button, .btn, [role="button"]');
    
    buttons.forEach(button => {
      const buttonText = button.textContent?.toLowerCase() || '';
      const buttonClass = button.className || '';
      
      // 反応ボタン
      if (buttonClass.includes('reaction') || buttonText.includes('react')) {
        this.enhanceReactionButton(button, linkInfo);
      }
      
      // コメントボタン
      if (buttonText.includes('comment') || buttonClass.includes('comment')) {
        this.enhanceCommentButton(button, linkInfo);
      }
      
      // ステータス変更ボタン
      if (buttonText.includes('close') || buttonText.includes('reopen') || buttonClass.includes('state')) {
        this.enhanceStateButton(button, linkInfo);
      }
    });
  }
  
  enhanceReactionButton(button, linkInfo) {
    // 反応ボタンの機能を追加
    button.addEventListener('click', (event) => {
      event.preventDefault();
      this.showTooltip(button, '反応を追加するには新しいタブで開いてください');
    });
  }
  
  enhanceCommentButton(button, linkInfo) {
    // コメントボタンの機能を追加
    button.addEventListener('click', (event) => {
      event.preventDefault();
      this.showTooltip(button, 'コメントを投稿するには新しいタブで開いてください');
    });
  }
  
  enhanceStateButton(button, linkInfo) {
    // ステータス変更ボタンの機能を追加
    button.addEventListener('click', (event) => {
      event.preventDefault();
      this.showTooltip(button, 'ステータスを変更するには新しいタブで開いてください');
    });
  }
  
  enhanceForms(container, linkInfo) {
    // フォームの送信をブロックし、ガイダンスを表示
    const forms = container.querySelectorAll('form');
    
    forms.forEach(form => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.showTooltip(form, 'フォームの送信は新しいタブで行ってください');
      });
    });
  }
  
  showTooltip(element, message) {
    // ツールチップを表示
    const tooltip = document.createElement('div');
    tooltip.textContent = message;
    tooltip.style.cssText = `
      position: absolute;
      background: #24292f;
      color: white;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 11px;
      z-index: 10001;
      white-space: nowrap;
      pointer-events: none;
    `;
    
    const rect = element.getBoundingClientRect();
    tooltip.style.top = (rect.top - 35) + 'px';
    tooltip.style.left = rect.left + 'px';
    
    document.body.appendChild(tooltip);
    
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.parentNode.removeChild(tooltip);
      }
    }, 2000);
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