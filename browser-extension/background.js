// 初回インストール時、「ファイルのURLへのアクセスを許可する」設定が必要なことを
// 案内するページを開く(この設定は拡張機能側から自動で有効化できないため)。
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});
