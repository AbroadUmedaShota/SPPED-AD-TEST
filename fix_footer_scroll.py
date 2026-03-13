import codecs
import re

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read()

# ============================================================
# 1. Fix the footer HTML to match the page.css expected structure:
#    article.tate footer#before-footer h2, ul, ul li, h3, p > a
# ============================================================
import re

old_footer_re = r'<footer id="before-footer"[\s\S]*?</footer>'
new_footer = """<footer id="before-footer">
    <h2>SPEED AD</h2>
    <ul>
      <li>
        <h3>SPEED-ADについて</h3>
        <p><a href="index.html">無料ではじめる</a></p>
        <p><a href="index.html#top">ログイン</a></p>
        <p><a href="index.html">お問い合わせ</a></p>
        <p><a href="02_dashboard/help-center.html">ヘルプ</a></p>
      </li>
      <li>
        <h3>運営会社について</h3>
        <p><a href="https://www.abroad-o.com/service.html" target="_blank" rel="noopener noreferrer">当社サービス</a></p>
        <p><a href="https://www.abroad-o.com/about.html" target="_blank" rel="noopener noreferrer">会社情報</a></p>
        <p><a href="https://speed-ad.com/tokushou" target="_blank" rel="noopener noreferrer">特定商取引法に基づく表記</a></p>
        <p><a href="02_dashboard/terms-of-service.html">利用規約</a></p>
        <p><a href="https://www.abroad-o.com/rule.html" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a></p>
      </li>
    </ul>
  </footer>"""

html = re.sub(old_footer_re, new_footer, html, flags=re.DOTALL)

# ============================================================
# 2. Fix the fullPage.js initialization (broken JS syntax)
# ============================================================
old_js = """  <script type="text/javascript">
    .ready(function() {
      if(typeof $.fn.fullpage !== 'undefined') {
        #fullpage.fullpage({
          anchors: ['top', 'contents1', 'contents2','contents3','contents4','contents5','contents6'],
          navigation: true,
          navigationPosition: 'right',
          responsiveWidth: 1024,
          scrollOverflow: true
        });
      }
    });
  </script>"""

new_js = """  <script type="text/javascript">
    $(document).ready(function() {
      if(typeof $.fn.fullpage !== 'undefined') {
        $('#fullpage').fullpage({
          anchors: ['top', 'contents1', 'contents2', 'contents3', 'contents4', 'contents5', 'contents6'],
          navigation: true,
          navigationPosition: 'right',
          responsiveWidth: 1024,
          scrollOverflow: true,
          autoScrolling: true,
          scrollingSpeed: 700,
          fitToSection: true,
          keyboardScrolling: true,
          touchSensitivity: 15
        });
      }
    });
  </script>"""

html = html.replace(old_js, new_js)

with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("Footer HTML and fullPage.js JS fixed successfully.")
