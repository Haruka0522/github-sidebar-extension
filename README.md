# GitHub Sidebar Extension

GitHubのIssue一覧やPR一覧画面で、個別のIssue/PRをクリックしたときにページ遷移せずにサイドバーで詳細を表示できるChrome拡張機能です。

## 機能

- **リンクインターセプト**: Issue/PRリンクのクリックを検出してページ遷移を防止
- **iframe表示**: webRequest APIを使用してX-Frame-Optionsヘッダーを削除し、サイドバー内でGitHubページを直接表示
- **ネイティブ体験**: GitHubの標準UIをそのまま使用可能（コメント投稿、ステータス変更等）
- **完全統合**: 同一ウィンドウ内でのシームレスな体験
- **トークン不要**: GitHub APIトークンの設定は不要

## Chromeへの導入方法

### 1. ソースコードの取得

```bash
# リポジトリをクローン
git clone <repository-url>
cd github-sidebar-extension

# 依存関係をインストール
npm install

# テストを実行（任意）
npm test
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
- Chromeツールバーに拡張機能のアイコンが追加される

### 3. GitHub Personal Access Tokenの設定

#### ステップ1: GitHubでトークンを作成
1. [GitHub Settings](https://github.com/settings/tokens/new) にアクセス
2. 「Generate new token (classic)」をクリック
3. 以下の設定を行う：
   - **Note**: `GitHub Sidebar Extension` など識別しやすい名前
   - **Expiration**: 適切な有効期限を選択
   - **Scopes**: 最低限 `repo` スコープを選択
     - Private repositoryにもアクセスする場合は `repo` 全体
     - Public repositoryのみの場合は `public_repo`
4. 「Generate token」をクリック
5. 生成されたトークンをコピー（一度しか表示されません）

#### ステップ2: 拡張機能にトークンを設定
1. Chromeツールバーの拡張機能アイコンをクリック
2. ポップアップが開いたら、「Token:」フィールドに先ほどコピーしたトークンを貼り付け
3. 「Save Token」ボタンをクリック
4. 「Token saved and validated successfully!」メッセージが表示されれば設定完了

## 使用方法

### 基本的な使い方

1. **GitHubのIssue/PR一覧ページを開く**
   - GitHub.comの任意のリポジトリのIssuesまたはPull Requestsページにアクセス

2. **Issue/PRをクリック**
   - 一覧から任意のIssue/PRのタイトルリンクをクリック
   - 通常のページ遷移の代わりに、サイドバーが右側からスライドインして表示されます
   - **注意**: 初回クリック時にサイドバーが作成され、以降はクリックするたびに内容が更新されます

3. **サイドバーでGitHubページを表示**
   - **完全なGitHub UI**: サイドバー内のiframeで実際のGitHubページが表示されます
   - **フル機能利用**: コメント投稿、ステータス変更、ラベル編集等すべての機能が利用可能
   - **ナビゲーション機能**: 
     - 戻るボタン（←）: iframe内で前のページに戻る
     - リフレッシュボタン（⟳）: 現在のページを再読み込み
     - 新しいタブボタン（↗）: 同じページを新しいタブで開く
     - 閉じるボタン（×）: サイドバーを閉じる
   - **技術**: webRequest APIでX-Frame-Optionsヘッダーを削除してiframe表示を実現

### キーボードショートカット（予定）
- `Ctrl+Shift+G` (Windows/Linux) または `Cmd+Shift+G` (Mac): サイドバーの表示切り替え

## トラブルシューティング

### よくある問題と解決方法

#### 1. 拡張機能が読み込めない
- **原因**: ファイルパスが正しくない
- **解決**: プロジェクトのルートディレクトリ（`manifest.json`があるフォルダ）を選択

#### 2. GitHubでサイドバーが表示されない
- **原因**: Content Scriptが実行されていない
- **解決**: 
  - ページをリロード（F5）
  - 拡張機能を一度無効化→有効化
  - `chrome://extensions/` で拡張機能の詳細を確認

#### 3. APIエラーが発生する
- **原因**: トークンが無効または権限不足
- **解決**:
  - 新しいトークンを生成して再設定
  - 必要なスコープ（`repo`）が選択されているか確認

#### 4. Private repositoryにアクセスできない
- **原因**: トークンに適切な権限がない
- **解決**: トークン作成時に `repo` 全体のスコープを選択

### エラーログの確認方法

1. **拡張機能のエラー確認**:
   - `chrome://extensions/` → 拡張機能の「詳細」→「エラー」

2. **Background Scriptのログ確認**:
   - `chrome://extensions/` → 拡張機能の「background page を検査」

3. **Content Scriptのログ確認**:
   - GitHubページでF12を押してDevToolsを開く → Consoleタブ

## 開発者向け情報

### テスト実行
```bash
npm test          # 全テスト実行
npm run test:watch # ウォッチモード
```

### リント実行
```bash
npm run lint
```

### アーキテクチャ

#### 主要コンポーネント
- **`manifest.json`** - Chrome拡張の設定
- **`src/background.js`** - Service Worker (GitHub API処理)
- **`src/content.js`** - Content Script (サイドバー注入)
- **`src/popup.html/js`** - 拡張ポップアップ画面
- **`src/github-api.js`** - GitHub API ラッパー

#### データフロー
1. Content Script がページにサイドバーを注入
2. サイドバーから Background Script へデータリクエスト
3. Background Script が GitHub API を呼び出し
4. 結果をサイドバーに表示

## セキュリティ

- Personal Access Token は Chrome Storage API で安全に保存
- GitHub API コールは Background Script 経由でCORS回避
- CSP (Content Security Policy) による保護
- トークンは暗号化されてローカルに保存

## アップデート

拡張機能を更新する場合：
1. 最新のソースコードを取得（`git pull`）
2. `chrome://extensions/` で拡張機能の更新ボタン（🔄）をクリック

## ライセンス

MIT License