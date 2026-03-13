import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

css_replacements = {
    r'\.form-container \{\s*background-color: var\(--color-surface-bright\);.*?\n\s*padding: var\(--spacing-10\);.*?\n\s*border-radius: var\(--border-radius-lg\);.*?\n\s*box-shadow: var\(--shadow-level-3\);': 
    '.form-container {\\n      padding: 0;\\n      width: 100%;',
    
    r'\.form-container__title \{\s*text-align: center;\s*margin-bottom: var\(--spacing-8\);.*?color: var\(--color-on-surface\);':
    '.form-container__title {\\n      text-align: center;\\n      margin-bottom: var(--spacing-8);\\n      color: #fff;',
    
    r'\.form-group__label \{\s*display: block;\s*margin-bottom: var\(--spacing-2\);.*?color: var\(--color-on-surface\);':
    '.form-group__label {\\n      display: block;\\n      margin-bottom: var(--spacing-2);\\n      color: #fff;',
    
    r'\.form-options__checkbox-label \{\s*display: flex;\s*align-items: center;\s*gap: var\(--spacing-1\);.*?color: var\(--color-on-surface\);':
    '.form-options__checkbox-label {\\n      display: flex;\\n      align-items: center;\\n      gap: var(--spacing-1);\\n      margin-bottom: var(--spacing-0);\\n      font-weight: normal;\\n      font-size: 0.9rem;\\n      color: #fff;',
    
    r'\.divider \{\s*text-align: center;\s*margin: var\(--spacing-7\) var\(--spacing-0\);.*?color: var\(--color-on-surface-light\);':
    '.divider {\\n      text-align: center;\\n      margin: var(--spacing-7) var(--spacing-0);\\n      position: relative;\\n      color: rgba(255,255,255,0.7);',
    
    r'\.divider__text \{\s*padding: var\(--spacing-0\) var\(--spacing-4\);.*?background: var\(--color-surface-bright\);.*?position: relative;\s*z-index: 1;\s*\}':
    '.divider__text {\\n      padding: var(--spacing-0) var(--spacing-4);\\n      background: transparent;\\n      position: relative;\\n      z-index: 1;\\n    }',
    
    r'\.form-options__link \{\s*color: var\(--color-primary\);':
    '.form-options__link {\\n      color: var(--color-secondary);',
    
    r'\.sub-links__item \{\s*color: var\(--color-primary\);':
    '.sub-links__item {\\n      color: var(--color-secondary);',
    
    r'\.footer \{\s*text-align: center;\s*margin-top: var\(--spacing-8\);.*?color: var\(--color-on-surface-light\);':
    '.footer {\\n      text-align: center;\\n      margin-top: var(--spacing-8);\\n      color: rgba(255,255,255,0.7);',

    r'color: var\(--color-on-surface-light\); \/\* Hint color \*\/':
    'color: rgba(255, 255, 255, 0.7); /* Hint color */',

    r'\.scenario-accounts__title \{\s*font-size: 0\.9rem;\s*font-weight: 600;\s*margin: 0 0 var\(--spacing-3\);\s*color: var\(--color-on-surface-variant\);':
    '.scenario-accounts__title {\\n      font-size: 0.9rem;\\n      font-weight: 600;\\n      margin: 0 0 var(--spacing-3);\\n      color: #fff;'
}

for old, new in css_replacements.items():
    html = re.sub(old, new, html, flags=re.MULTILINE|re.DOTALL)

html = re.sub(r'body \{\s*font-family: [^}]+\}', '''body {
      font-family: "Noto Sans JP", "Inter", sans-serif;
      margin: 0;
      padding: 0;
    }''', html, flags=re.MULTILINE|re.DOTALL)

html = re.sub(r'body::before \{[^}]+\}', '', html, flags=re.MULTILINE|re.DOTALL)

legacy_css = '''
    /* Legacy Layout Styles */
    #all {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        min-height: 100vh;
        background: url("img/top-kv.jpg") no-repeat center;
        background-size: cover;
        padding: 0 10%;
        box-sizing: border-box;
        position: relative;
    }
    #all:before {
        content: "";
        display: block;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(180deg, rgba(100, 100, 100, 0.85), rgba(0, 17, 46, 0.85));
        z-index: 1;
    }
    #text-box {
        width: 50%;
        position: relative;
        z-index: 2;
    }
    #text-box ul {
        display: flex;
        width: 95%;
        margin: 0 0 5vh 0;
        padding: 0;
        list-style: none;
    }
    #text-box ul li {
        padding: 5px 20px;
        text-align: center;
        background: #fff;
        font-weight: 500;
        font-size: 1rem;
    }
    #text-box ul li:nth-child(1) { border: 1px solid #004ad0; color: #004ad0; margin-right: 10px; }
    #text-box ul li:nth-child(2) { border: 1px solid #3200a2; color: #3200a2; margin-right: 10px; }
    #text-box ul li:nth-child(3) { border: 1px solid #a50076; color: #a50076; }
    #text-box h1 {
        margin: 0 0 5vh 0;
        display: flex;
        align-items: center;
    }
    #text-box h1 img {
        width: 50%;
        margin: 0;
    }
    #text-box h1 span {
        color: #fff;
        margin-left: 30px;
        display: inline-block;
        font-weight: bold;
        font-size: 1.5rem;
    }
    #text-box p {
        text-align: left;
        color: #fff;
        font-weight: bold;
        letter-spacing: 0.1em;
        line-height: 1.6;
    }
    #input-box {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: 400px;
    }
    @media (max-width: 1024px) {
        #all {
            flex-direction: column;
            padding: 5% 5%;
        }
        #text-box, #input-box {
            width: 100%;
        }
        #text-box h1 {
            flex-direction: column;
        }
        #text-box h1 span {
            margin-top: 10px;
            font-size: 1.2rem;
        }
    }
'''
html = html.replace('.page-wrapper {', legacy_css + '\\n    .page-wrapper {')

old_html = '''  <div class="page-wrapper" role="main">
    <div class="info-panel">
      <h2 class="info-panel__title">SPEED AD とは？</h2>
      <p class="info-panel__description">
        SPEED ADは、展示会やセミナーなどのイベント向けソリューションです。<br>
        無料のWEBアンケート作成、名刺のデータ化、御礼メールの送信を一気通貫で提供し、
        獲得したリードの有効活用をワンストップで実現します。
      </p>
    </div>
    <div class="form-container">'''

new_html = '''  <div id="all" role="main">
    <div id="text-box">
      <ul>
        <li>WEBアンケート作成</li>
        <li>名刺のデータ化</li>
        <li>御礼メールの送信</li>
      </ul>
      <h1><img src="img/logo.svg" alt="SPEED-AD"><span>～スピード アド～</span></h1>
      <p>SPEED ADは、展示会やセミナーなどのイベント向けソリューションです。<br>
        無料のWEBアンケート作成、名刺のデータ化、御礼メールの送信を一気通貫で提供し、獲得したリードの有効活用をワンストップで実現します</p>
    </div>
    <div id="input-box" class="form-container">'''

html = html.replace(old_html, new_html)

# also change text-on-surface-light inline classes to style
html = html.replace('text-on-surface-light', 'text-white')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Done")
