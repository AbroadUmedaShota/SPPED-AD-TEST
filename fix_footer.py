import re
import codecs

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read()

# 1. Force white color on specific elements in the form box for BOTH pc and mobile
css_addition = """
    /* --- Specific Form Text Colors for Dark Background --- */
    #before-login #input-box.form-container .form-group__label,
    #before-login #input-box.form-container .form-options__checkbox-label,
    #before-login #input-box.form-container .form-options__checkbox-label span,
    #before-login #input-box.form-container .scenario-accounts__title,
    #before-login #input-box.form-container .scenario-accounts__email,
    #before-login #input-box.form-container .scenario-accounts__badge {
        color: #fff !important;
    }
    #before-login #input-box.form-container .form-options {
        color: #fff !important;
    }
    #before-login #input-box.form-container .divider::before,
    #before-login #input-box.form-container .divider::after {
        background: rgba(255, 255, 255, 0.3) !important;
    }
    </style>
"""
html = html.replace('</style>', css_addition)

# 2. Inject the footer content
footer_content = """<div style="text-align: center; width: 100%;">
      <div class="sub-links" style="margin-bottom: 20px;">
        <a href="http://127.0.0.1:5500/02_dashboard/terms-of-service.html" class="sub-links__item" style="color: #fff; margin: 0 10px;">利用規約</a> | 
        <a href="https://www.abroad-o.com/rule.html" class="sub-links__item" target="_blank" rel="noopener noreferrer" style="color: #fff; margin: 0 10px;">プライバシーポリシー</a> | 
        <a href="02_dashboard/help-center.html" class="sub-links__item" style="color: #fff; margin: 0 10px;">サポート</a>
      </div>
      <div class="mt-4 text-center text-xs text-on-surface-light" style="margin-bottom: 20px; color: rgba(255,255,255,0.7); font-size: 13px;">
          【開発者向け】<a href="02_dashboard/changelog.html" class="hover:underline" style="color: #fff; text-decoration: underline;">変更履歴</a>
      </div>
      <div class="footer" style="color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 0;">&copy; 2025 SPEED AD - All rights reserved.</div>
    </div></footer>"""

html = re.sub(r'<footer id="before-footer"[^>]*>.*?</footer>', r'<footer id="before-footer" style="padding: 5vh 0; background: linear-gradient(180deg, #899bb3, #4b525d); margin: 0; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; min-height: 45vh; box-sizing: border-box;">' + footer_content, html, flags=re.DOTALL)

with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("Text colors forced to white and footer restored.")
