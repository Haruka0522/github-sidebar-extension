# GitHub Sidebar Extension

GitHubのIssue/PR画面で、個別のIssue/PRをクリックしたときにページ遷移せずにサイドバーで詳細を表示できるChrome拡張機能です。

## ✨ 特徴

- **🔗 スマートリンク検知**: Issue/PRリンクのクリックを自動検出してページ遷移を防止
- **📱 iframe完全統合**: declarativeNetRequest APIでX-Frame-Options/CSPヘッダーを削除し、サイドバー内で本物のGitHubページを表示
- **🚀 ネイティブ体験**: GitHubの標準UIをそのまま使用（コメント投稿、ステータス変更、ラベル編集等）
- **🔄 シームレスナビゲーション**: サイドバー表示中のページ遷移でもレイアウトを維持
- **📏 リサイズ対応**: マウスドラッグでサイドバー幅を自由に調整（300px - 800px）
- **🎯 全ページ対応**: レポジトリ、ファイルブラウザ、コミット、ブランチ等すべてのGitHubページ
- **🔒 トークン不要**: GitHub Personal Access Tokenの設定は不要
- **⚡ 高性能**: 動的レイアウト監視とパフォーマンス最適化

## 🎬 デモ

サイドバーでGitHubの完全な機能を利用できます：
- ✅ Issue/PRの詳細閲覧
- 💬 コメントの投稿・編集
- 🏷️ ラベルの追加・削除
- 📊 ステータスの変更（Open/Closed）
- 👥 アサイン機能
- 🔗 関連Issue/PRへのナビゲーション

## 🚀 インストール方法

### 1. ソースコードの取得

```bash
# リポジトリをクローン
git clone <repository-url>
cd github-sidebar-extension
```

### 2. Chrome拡張機能として読み込み

#### ステップ1: Chromeの拡張機能ページを開く
1. Google Chromeを起動
2. アドレスバーに `chrome://extensions/` と入力してEnter
3. または、Chrome メニュー（⋮）→ その他のツール → 拡張機能

#### ステップ2: デベロッパーモードを有効化
1. 拡張機能ページの右上にある「デベロッパーモード」のトグルスイッチをONにする

#### ステップ3: 拡張機能を読み込み
1. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリック
2. ファイル選択ダイアログで、`github-sidebar-extension` フォルダを選択
3. 「フォルダーの選択」をクリック

#### ステップ4: 拡張機能の確認
拡張機能が正常に読み込まれると：
- 拡張機能一覧に「GitHub Sidebar」が表示される
- Chromeツールバーに拡張機能のアイコンが追加される（オプション）

## 📖 使用方法

### 基本的な使い方

1. **GitHubのIssue/PR画面を開く**
   - GitHub.comの任意のリポジトリのIssuesまたはPull Requestsページにアクセス

2. **Issue/PRをクリック**
   - 一覧から任意のIssue/PRのタイトルリンクをクリック
   - 通常のページ遷移の代わりに、サイドバーが右側からスライドインして表示されます

3. **サイドバーでフル機能を利用**
   - **📄 完全なGitHub UI**: サイドバー内のiframeで実際のGitHubページが表示
   - **🔧 全機能利用可能**: コメント投稿、ステータス変更、ラベル編集等すべての機能
   - **🔄 ナビゲーション機能**: 
     - 戻るボタン（←）: iframe内で前のページに戻る
     - リフレッシュボタン（⟳）: 現在のページを再読み込み
     - 新しいタブボタン（↗）: 同じページを新しいタブで開く
     - 閉じるボタン（×）: サイドバーを閉じる

4. **サイドバーのカスタマイズ**
   - **📏 幅調整**: サイドバー左端をマウスドラッグして幅を調整
   - **💾 設定保存**: 調整した幅は自動的に保存され、次回使用時に復元

5. **ページ遷移中も維持**
   - サイドバー表示中に他のGitHubページに移動してもレイアウトが維持されます
   - 戻る・進むボタンを使用してもサイドバーは表示され続けます

### 対応ページ

✅ **完全対応**:
- Issue一覧・詳細ページ
- Pull Request一覧・詳細ページ
- レポジトリホームページ
- ファイルブラウザ
- コミット一覧・詳細
- ブランチ一覧
- タグ一覧
- リリース一覧
- その他すべてのGitHubページ

## ⚡ 技術的な実装

### 🏗️ アーキテクチャ

- **Manifest V3**: 最新のChrome拡張API
- **declarativeNetRequest**: X-Frame-Options/CSPヘッダー削除でiframe表示を実現
- **動的レイアウト監視**: MutationObserver + History API監視
- **適応型レイアウト**: GitHubの標準レイアウトを保ちながらサイドバー領域を確保

### 🔒 セキュリティ

- **トークン不要**: GitHub Personal Access Tokenは不要
- **既存セッション利用**: ユーザーの既存GitHubログインセッションを安全に利用
- **CSP準拠**: Chrome拡張のContent Security Policyに準拠
- **権限最小化**: 必要最小限の権限のみ要求

### ⚙️ パフォーマンス最適化

- **デバウンス処理**: レイアウト更新の最適化（50ms）
- **requestAnimationFrame**: スムーズなアニメーション
- **条件付き更新**: 必要時のみDOM操作を実行
- **効率的な監視**: MutationObserverで最小限のDOM変更のみ検知

## 🛠️ トラブルシューティング

### よくある問題と解決方法

#### 1. 拡張機能が読み込めない
- **原因**: ファイルパスが正しくない、または権限不足
- **解決**: 
  - プロジェクトのルートディレクトリ（`manifest.json`があるフォルダ）を選択
  - ファイルの読み取り権限を確認

#### 2. サイドバーが表示されない
- **原因**: Content Scriptが実行されていない
- **解決**: 
  - ページをリロード（F5）
  - 拡張機能を一度無効化→有効化
  - `chrome://extensions/` で拡張機能のエラーを確認

#### 3. iframe内でページが表示されない
- **原因**: declarativeNetRequestルールが適用されていない
- **解決**:
  - 拡張機能を再読み込み
  - Chrome Developer Tools のNetwork タブでヘッダーを確認
  - `chrome://extensions/` でエラーログを確認

#### 4. レイアウトが崩れる
- **原因**: ページ遷移時にCSSクラスが消失
- **解決**:
  - ページをリロードして再試行
  - 別のページに移動してから戻る
  - サイドバーを一度閉じて再度開く

#### 5. リサイズが効かない
- **原因**: リサイズハンドルが見つからない、またはイベントリスナーが無効
- **解決**:
  - サイドバー左端の細い領域（5px幅）をドラッグ
  - マウスカーソルが「←→」アイコンに変わることを確認

### 🔍 エラーログの確認方法

1. **拡張機能のエラー確認**:
   - `chrome://extensions/` → 拡張機能の「詳細」→「エラー」

2. **Background Scriptのログ確認**:
   - `chrome://extensions/` → 拡張機能の「Service Worker」をクリック

3. **Content Scriptのログ確認**:
   - GitHubページでF12を押してDevToolsを開く → Consoleタブ

4. **Network問題の確認**:
   - DevTools → Network タブで宣言的ネットワークリクエストルールの適用を確認

## 🔧 開発者向け情報

### ファイル構造
```
github-sidebar-extension/
├── manifest.json          # 拡張機能の設定
├── rules.json            # declarativeNetRequest ルール
├── src/
│   ├── content.js        # メインのコンテンツスクリプト
│   ├── sidebar.css       # サイドバーのスタイル
│   ├── background.js     # Service Worker
│   ├── popup.html        # 拡張機能ポップアップ
│   └── popup.js          # ポップアップのロジック
└── README.md
```

### 主要機能の実装

#### 1. リンクインターセプト (`content.js`)
```javascript
// Issue/PRリンクの検知と処理
attachLinkListeners() {
  const linkSelectors = [
    'a[href*="/issues/"]',
    'a[href*="/pull/"]',
    'a[data-hovercard-type="issue"]',
    'a[data-hovercard-type="pull_request"]'
  ];
  // クリックイベントリスナーの追加
}
```

#### 2. 動的レイアウト監視 (`content.js`)
```javascript
// ページ遷移時のレイアウト維持
setupNavigationListener() {
  // MutationObserver + History API監視
  // popstate, pushState, replaceState イベント対応
}
```

#### 3. declarativeNetRequest ルール (`rules.json`)
```json
{
  "action": {
    "type": "modifyHeaders",
    "responseHeaders": [
      {"header": "X-Frame-Options", "operation": "remove"},
      {"header": "Content-Security-Policy", "operation": "remove"}
    ]
  }
}
```

### デバッグのコツ

- **レイアウト問題**: `ensureSidebarLayout()` の実行タイミングを確認
- **ナビゲーション問題**: `handleNavigation()` のログを監視
- **iframe問題**: Network タブでresponse headersを確認
- **パフォーマンス**: MutationObserverの発火頻度をConsoleで監視

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエストやIssueの報告を歓迎します！

---

**注意**: この拡張機能はGitHub.com専用です。GitHub Enterprise Serverには対応していません。