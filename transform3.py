import codecs
import re
import os
import urllib.request

# 1. Image downloads
images = [
    "pic1.jpg", "pic2.jpg", "pic3.jpg", 
    "back-circle.png", "back-circle2.png", 
    "icon1.png", "icon2.png", "icon3.png", 
    "icon4.png", "icon5.png", "icon6.png",
    "logo2.svg", "arrow-right.png"
]
os.makedirs('img', exist_ok=True)
for img in images:
    path = os.path.join('img', img)
    if not os.path.exists(path):
        try:
            print(f"Downloading {img}...")
            urllib.request.urlretrieve(f"https://dev.speed-ad.com/img/{img}", path)
        except Exception as e:
            print(f"Failed to download {img}: {e}")

# 2. CSS preparation
os.makedirs('css', exist_ok=True)
if os.path.exists('legacy_page.css') and not os.path.exists('css/page.css'):
    os.rename('legacy_page.css', 'css/page.css')

# 3. HTML parsing
with codecs.open('index.html', 'r', 'utf-8') as f:
    html = f.read()

with codecs.open('legacy_login.html', 'r', 'utf-8') as f:
    legacy = f.read()

if "css/page.css" not in html:
    html = html.replace('</title>', '</title>\n  <link rel="stylesheet" href="css/page.css">\n  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/fullPage.js/2.9.7/jquery.fullpage.min.css">')

if '<body id="before-login">' not in html:
    html = html.replace('<body>', '<body id="before-login">')

match = re.search(r'(<div class="section" id="section1">.*?)(<footer id="before-footer">)', legacy, re.DOTALL)
sections_html = ""
if match:
    sections_html = match.group(1)

footer_pattern = r'(\s*<div class="sub-links">.*?</div>\s*<div class="mt-4 text-center text-xs text-white">.*?</div>\s*<div class="footer">.*?</div>)'
footer_match = re.search(footer_pattern, html, re.DOTALL)
new_footer_html = ""
if footer_match:
    new_footer_html = footer_match.group(1)
    html = html.replace(new_footer_html, '')

if '<div id="fullpage">' not in html:
    html = html.replace('<div id="all" role="main">', '<main>\n  <div id="fullpage">\n    <div class="section " id="section0">\n      <div id="all" role="main">')
    
    end_all = r'(\s*)</div>(\s*<!-- 新規アカウント作成モーダル -->)'
    
    footer_wrapper = f'\\n    <footer id="before-footer" style="padding: 5vh 0; background: linear-gradient(180deg, #899bb3, #4b525d); margin: 0; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; min-height: 45vh; box-sizing: border-box;">\\n      <div style="text-align: center;">{new_footer_html}</div>\\n    </footer>\\n  </article>\\n    </div>\\n'
    
    replacement = r'\1</div>\n    </div>\n' + sections_html + footer_wrapper + r'  </div>\n</main>\2'
    html = re.sub(end_all, replacement, html)

css_replace = r'\.form-container \{\s*padding: 0;\s*width: 100%;\s*max-width: 400px;\s*box-sizing: border-box;\s*\}'
new_css = '.form-container {\\n      padding: 30px;\\n      width: 100%;\\n      max-width: 450px;\\n      background-color: rgba(0, 0, 0, 0.65);\\n      border-radius: 12px;\\n      box-shadow: 0 4px 15px rgba(0,0,0,0.5);\\n      box-sizing: border-box;\\n      backdrop-filter: blur(4px);\\n    }'
html = re.sub(css_replace, new_css, html)

cdn_scripts = r'''
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/fullPage.js/2.9.7/jquery.fullpage.min.js"></script>
  <script type="text/javascript">
    $(document).ready(function() {
      if(typeof $.fn.fullpage !== 'undefined') {
        $('#fullpage').fullpage({
          anchors: ['top', 'contents1', 'contents2','contents3','contents4','contents5','contents6'],
          navigation: true,
          navigationPosition: 'right',
          responsiveWidth: 1024,
          scrollOverflow: true
        });
      }
    });
  </script>
'''

if "jquery.fullpage.min.js" not in html:
    html = html.replace('</body>', cdn_scripts + '\n</body>')

with codecs.open('index.html', 'w', 'utf-8') as f:
    f.write(html)
print("Done reconstructing HTML")
