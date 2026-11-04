# 家計簿 GitHub Pages版

v1.3。公開用アプリファイルだけを収録。個人残高、取引データ、テスト画像、バックアップは含まれません。

GitHubリポジトリのルートへ配置し、Settings → Pages → Deploy from a branch → main / (root) で公開します。公開URLはGitHubが表示する値を使用してください。

GitHub Pagesは通常インターネット上に公開されます。家計データは端末内だけに保存されますが、バックアップJSONをリポジトリへ追加しないでください。

移行前に旧URLの設定でJSONを書き出し、新URLをiPhoneのホーム画面に追加した後、そのホーム画面アプリからJSONを読み込みます。保存領域はURLとブラウザによって異なり、自動同期はありません。

同じGitHub Pagesオリジンの別アプリとはlocalStorageを共有します。同じオリジンへ信頼できないコードを配置しないでください。独立したカスタムドメインを使う場合は別の保存領域になります。

バックアップは定期的に端末外にも保管してください。

公式手順：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
