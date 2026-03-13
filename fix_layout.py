import codecs

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read().replace('\r\n', '\n')

old_form_container = """.form-container {
      padding: 30px;
      width: 100%;
      max-width: 450px;
      background-color: rgba(0, 0, 0, 0.65);
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      box-sizing: border-box;
      backdrop-filter: blur(4px);
    }"""
new_form_container = """#before-login #input-box.form-container {
      padding: 30px;
      width: 100%;
      max-width: 450px;
      background-color: rgba(0, 0, 0, 0.65) !important; /* Force override legacy CSS */
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      box-sizing: border-box;
      backdrop-filter: blur(4px);
    }"""
html = html.replace(old_form_container, new_form_container)

old_title = """.form-container__title {
      text-align: center;
      margin-bottom: var(--spacing-8);
      color: #fff;
      font-size: 1.875rem; /* Material 3 headline-small 相当 */
      font-weight: 700;
    }"""
new_title = """.form-container__title {
      text-align: center;
      margin-bottom: var(--spacing-8);
      color: #fff;
      font-size: 1.5rem; /* Material 3 headline-small 相当 (縮小) */
      font-weight: 700;
      white-space: nowrap;
      letter-spacing: 0.05em;
    }"""
html = html.replace(old_title, new_title)

old_googleBtn = """.button--google { /* google-button */
      background-color: var(--color-surface-bright);
      border: 1px solid var(--color-outline);
      color: var(--color-on-surface-variant);
      font-weight: 500;
      margin-top: var(--spacing-6); /* 24px */
      box-shadow: var(--shadow-level-1);
    }"""
new_googleBtn = """.button--google { /* google-button */
      background-color: #fff;
      border: 1px solid #d1d5db;
      color: #374151;
      font-weight: 600;
      margin-top: var(--spacing-6); /* 24px */
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      gap: 10px;
      padding: 12px 16px;
      width: 100%;
      border-radius: 8px;
    }"""
html = html.replace(old_googleBtn, new_googleBtn)

old_mobile_form = """.form-container {
        padding: var(--spacing-8); /* 32px */
        max-width: 100%; /* スマホではいっぱいに近い幅 */
      }"""
new_mobile_form = """#before-login #input-box.form-container {
        padding: var(--spacing-8); /* 32px */
        max-width: 100%; /* スマホではいっぱいに近い幅 */
      }"""
html = html.replace(old_mobile_form, new_mobile_form)

old_mobile_title = """.form-container__title {
        font-size: 1.75rem;
        margin-bottom: var(--spacing-6); /* 24px */
      }"""
new_mobile_title = """.form-container__title {
        font-size: 1.3rem; 
        margin-bottom: var(--spacing-6); /* 24px */
        white-space: nowrap;
      }"""
html = html.replace(old_mobile_title, new_mobile_title)

# Additionally, the legacy string width might be breaking layout. 
html = html.replace('max-width: 400px; /* フォームコンテナの幅を具体的に指定 */', 'max-width: 450px; /* modified */')

with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("Changes applied successfully.")
