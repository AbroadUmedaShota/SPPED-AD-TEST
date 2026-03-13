import codecs
import re

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read()

# Replace the entire footer block with a new clean footer
old_footer_re = r'<footer id="before-footer"[\s\S]*?</footer>'

new_footer = """<footer id="before-footer" style="background: #f3f4f5; padding: 54px 60px; width: 100%; box-sizing: border-box; border-top: 1px solid #e0e0e0; font-family: inherit;">
  <div style="max-width: 1100px; margin: 0 auto; display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 40px; flex-wrap: wrap;">
    <!-- ロゴ -->
    <div style="flex: 1; min-width: 160px;">
      <p style="font-size: 22px; font-weight: 800; color: #222; letter-spacing: 1px; margin: 0;">SPEED AD</p>
    </div>
    <!-- SPEED-ADについて -->
    <div style="flex: 1; min-width: 160px;">
      <p style="font-size: 13px; font-weight: 700; color: #444; margin: 0 0 14px 0;">SPEED-ADについて</p>
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
        <li><a href="index.html" style="font-size: 14px; color: #333; text-decoration: none;">無料ではじめる</a></li>
        <li><a href="index.html#top" style="font-size: 14px; color: #333; text-decoration: none;">ログイン</a></li>
        <li><a href="index.html" style="font-size: 14px; color: #333; text-decoration: none;">お問い合わせ</a></li>
        <li><a href="02_dashboard/help-center.html" style="font-size: 14px; color: #333; text-decoration: none;">ヘルプ</a></li>
      </ul>
    </div>
    <!-- 運営会社について -->
    <div style="flex: 1; min-width: 160px;">
      <p style="font-size: 13px; font-weight: 700; color: #444; margin: 0 0 14px 0;">運営会社について</p>
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
        <li><a href="https://www.abroad-o.com/service.html" target="_blank" rel="noopener noreferrer" style="font-size: 14px; color: #333; text-decoration: none;">当社サービス</a></li>
        <li><a href="https://www.abroad-o.com/about.html" target="_blank" rel="noopener noreferrer" style="font-size: 14px; color: #333; text-decoration: none;">会社情報</a></li>
        <li><a href="https://speed-ad.com/tokushou" target="_blank" rel="noopener noreferrer" style="font-size: 14px; color: #333; text-decoration: none;">特定商取引法に基づく表記</a></li>
        <li><a href="02_dashboard/terms-of-service.html" style="font-size: 14px; color: #333; text-decoration: none;">利用規約</a></li>
        <li><a href="https://www.abroad-o.com/rule.html" target="_blank" rel="noopener noreferrer" style="font-size: 14px; color: #333; text-decoration: none;">プライバシーポリシー</a></li>
      </ul>
    </div>
  </div>
  <div style="max-width: 1100px; margin: 40px auto 0; border-top: 1px solid #d5d5d5; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
    <p style="font-size: 12px; color: #999; margin: 0;">&copy; 2025 SPEED AD - All rights reserved.</p>
    <a href="02_dashboard/changelog.html" style="font-size: 12px; color: #aaa; text-decoration: underline;">【開発者向け】変更履歴</a>
  </div>
</footer>"""

html = re.sub(old_footer_re, new_footer, html, flags=re.DOTALL)

with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("Footer replaced successfully.")
