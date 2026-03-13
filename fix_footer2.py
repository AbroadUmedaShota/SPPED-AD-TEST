import codecs
import re

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read()

# Replace the entire footer block with new white-background footer
old_footer = r'<footer id="before-footer"[^>]*>.*?</footer>'

new_footer = '''<footer id="before-footer" style="padding: 60px 20px 40px; background: #ffffff; margin: 0; color: #333; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; box-sizing: border-box; border-top: 1px solid #e5e7eb;">
  <div style="max-width: 900px; width: 100%; display: flex; flex-wrap: wrap; gap: 40px; justify-content: center; margin-bottom: 40px;">
    <!-- SPEED-ADについて -->
    <div style="min-width: 180px; flex: 1;">
      <h4 style="font-size: 14px; font-weight: 700; color: #111; margin-bottom: 16px; border-bottom: 2px solid #7c3aed; padding-bottom: 6px;">SPEED-ADについて</h4>
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
        <li><a href="index.html" style="color: #555; text-decoration: none; font-size: 14px; hover:color:#7c3aed;">無料ではじめる</a></li>
        <li><a href="index.html#top" style="color: #555; text-decoration: none; font-size: 14px;">ログイン</a></li>
        <li><a href="index.html" style="color: #555; text-decoration: none; font-size: 14px;">お問い合わせ</a></li>
        <li><a href="02_dashboard/help-center.html" style="color: #555; text-decoration: none; font-size: 14px;">ヘルプ</a></li>
      </ul>
    </div>
    <!-- 運営会社について -->
    <div style="min-width: 180px; flex: 1;">
      <h4 style="font-size: 14px; font-weight: 700; color: #111; margin-bottom: 16px; border-bottom: 2px solid #7c3aed; padding-bottom: 6px;">運営会社について</h4>
      <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
        <li><a href="https://www.abroad-o.com/service.html" target="_blank" rel="noopener noreferrer" style="color: #555; text-decoration: none; font-size: 14px;">当社サービス</a></li>
        <li><a href="https://www.abroad-o.com/about.html" target="_blank" rel="noopener noreferrer" style="color: #555; text-decoration: none; font-size: 14px;">会社情報</a></li>
        <li><a href="https://speed-ad.com/tokushou" target="_blank" rel="noopener noreferrer" style="color: #555; text-decoration: none; font-size: 14px;">特定商取引法に基づく表記</a></li>
        <li><a href="02_dashboard/terms-of-service.html" style="color: #555; text-decoration: none; font-size: 14px;">利用規約</a></li>
        <li><a href="https://www.abroad-o.com/rule.html" target="_blank" rel="noopener noreferrer" style="color: #555; text-decoration: none; font-size: 14px;">プライバシーポリシー</a></li>
      </ul>
    </div>
    <!-- 事務局情報 -->
    <div style="min-width: 200px; flex: 1;">
      <h4 style="font-size: 14px; font-weight: 700; color: #111; margin-bottom: 16px; border-bottom: 2px solid #7c3aed; padding-bottom: 6px;">事務局</h4>
      <p style="font-size: 13px; color: #666; line-height: 2; margin: 0;">SPEED AD事務局<br>運営会社：アブロードアウトソーシング株式会社<br><a href="mailto:customer@speed-ad.com" style="color: #7c3aed;">customer@speed-ad.com</a></p>
      <div style="margin-top: 16px;">
        <a href="02_dashboard/changelog.html" style="color: #888; font-size: 12px; text-decoration: underline;">【開発者向け】変更履歴</a>
      </div>
    </div>
  </div>
  <div style="border-top: 1px solid #e5e7eb; width: 100%; max-width: 900px; padding-top: 20px; text-align: center;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">&copy; 2025 SPEED AD - All rights reserved.</p>
  </div>
</footer>'''

html = re.sub(old_footer, new_footer, html, flags=re.DOTALL)

with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("Footer updated successfully.")
