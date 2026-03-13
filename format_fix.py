import re
import codecs

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read()

# 1. Change the form background to white and border-radius to smaller radius if needed according to image
# Looking at the user image, the background is white with a slight shadow, typical #fff.
html = html.replace('.form-container {\n      padding: 30px;\n      width: 100%;\n      max-width: 450px;\n      background-color: rgba(0, 0, 0, 0.65) !important; /* Force override legacy CSS */',
    '.form-container {\n      padding: 30px;\n      width: 100%;\n      max-width: 450px;\n      background-color: #ffffff !important; /* Force override legacy CSS */')

html = html.replace('background-color: rgba(0, 0, 0, 0.65) !important;', 'background-color: #ffffff !important;')

# 2. Revert the text colors inside the form to black/dark gray.
# Remove the entire block added to force white colors.
css_removal_target = """    /* --- Specific Form Text Colors for Dark Background --- */
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
    }"""
html = html.replace(css_removal_target, '')

# Also revert the title color from white to black
html = html.replace('.form-container__title {\n      text-align: center;\n      margin-bottom: var(--spacing-8);\n      color: #fff;',
    '.form-container__title {\n      text-align: center;\n      margin-bottom: var(--spacing-8);\n      color: var(--color-on-surface);')

# 3. Google button styling
# The image shows an outline button, logo heavily left-aligned, text centered.
google_btn_new = """.button--google { /* google-button */
      background-color: #fff;
      border: 1px solid #d1d5db;
      color: #374151;
      font-weight: 600;
      margin-top: var(--spacing-6); /* 24px */
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      position: relative !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      padding: 12px 16px;
      width: 100%;
      border-radius: 8px;
    }
    .button--google__logo {
      width: 20px;
      height: 20px;
      position: absolute;
      left: 16px;
    }"""

html = re.sub(
    r'\.button--google \{[\s\S]*?border-radius: 8px;\s*\}',
    google_btn_new, html
)

# And make sure `.button--google__logo` is cleaned up if it was previously defined differently:
html = re.sub(
    r'\.button--google__logo \{\s*width: 20px;\s*height: 20px;\s*vertical-align: middle;\s*\}',
    '', html
)


with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("Applied white background, dark text, and Google button design.")

