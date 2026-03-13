import re
import codecs

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read()

# 1. Fix .form-container background (previous regex failed)
new_css = """.form-container {
      padding: 30px;
      width: 100%;
      max-width: 450px;
      background-color: rgba(0, 0, 0, 0.65);
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      box-sizing: border-box;
      backdrop-filter: blur(4px);
    }"""
html = re.sub(r'\.form-container\s*\{[\s\S]*?width: 100%;[\s\S]*?box-sizing: border-box;\s*\}', new_css, html, count=1)

# 2. Fix the title wrapping by decreasing font size and forcing nowrap
html = html.replace('.form-container__title {\n      text-align: center;\n      margin-bottom: var(--spacing-8);\n      color: #fff;\n      font-size: 1.875rem; /* Material 3 headline-small 相当 */\n      font-weight: 700;\n    }',
'.form-container__title {\n      text-align: center;\n      margin-bottom: var(--spacing-8);\n      color: #fff;\n      font-size: 1.5rem; /* Adjusted to prevent wrapping */\n      font-weight: 700;\n      white-space: nowrap;\n      letter-spacing: 2px;\n    }')

# Fix mobile font-size as well
html = html.replace('.form-container__title {\n        font-size: 1.75rem;\n        margin-bottom: var(--spacing-6); /* 24px */\n      }',
'.form-container__title {\n        font-size: 1.3rem;\n        margin-bottom: var(--spacing-6); /* 24px */\n        white-space: nowrap;\n      }')

# 3. Enhance button styling globally to prevent distortion
google_btn_old = """.button--google { /* google-button */
      background-color: var(--color-surface-bright);
      border: 1px solid var(--color-outline);
      color: var(--color-on-surface-variant);
      font-weight: 500;
      margin-top: var(--spacing-6); /* 24px */
      box-shadow: var(--shadow-level-1);
    }"""
google_btn_new = """.button--google { /* google-button */
      background-color: #fff;
      border: 1px solid #d1d5db;
      color: #374151;
      font-weight: 600;
      margin-top: var(--spacing-6); /* 24px */
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
    }"""
html = html.replace(google_btn_old, google_btn_new)

# Make sure all transparent backgrounds meant to be black are updated in media queries
media_form_container_old = """.form-container {
        padding: var(--spacing-8); /* 32px */
        max-width: 100%; /* スマホではいっぱいに近い幅 */
      }"""
media_form_container_new = """.form-container {
        padding: var(--spacing-8); /* 32px */
        max-width: 100%; /* スマホではいっぱいに近い幅 */
        background-color: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
      }"""
html = html.replace(media_form_container_old, media_form_container_new)

with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("Applied fixes for dark background, title wrap, and google button.")
