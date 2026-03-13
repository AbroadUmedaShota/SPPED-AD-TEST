import re
import codecs

with codecs.open("index.html", "r", "utf-8") as f:
    html = f.read()

# Revert specific classes to use var(--color-on-surface)
html = html.replace("color: #fff;\n      font-weight: 600;\n      font-size: 0.95rem; /* 元の0.95remに戻す */\n    }", "color: var(--color-on-surface);\n      font-weight: 600;\n      font-size: 0.95rem; /* 元の0.95remに戻す */\n    }")

html = html.replace("font-size: 0.9rem;\n      color: #fff; /* Material 3 on-surface */", "font-size: 0.9rem;\n      color: var(--color-on-surface);")

html = html.replace("margin: 0 0 var(--spacing-3);\n      color: #fff;", "margin: 0 0 var(--spacing-3);\n      color: var(--color-on-surface);")

# Wait, let's use regex to be safe about exactly replacing the color attributes of these block definitions

html = re.sub(
    r'(\.form-group__label \{[\s\S]*?)color: #fff;([\s\S]*?\})',
    r'\1color: var(--color-on-surface);\2', html
)

html = re.sub(
    r'(\.form-options__checkbox-label \{[\s\S]*?)color: #fff; \/\* Material 3 on-surface \*\/([\s\S]*?\})',
    r'\1color: var(--color-on-surface);\2', html
)

html = re.sub(
    r'(\.scenario-accounts__title \{[\s\S]*?)color: #fff;([\s\S]*?\})',
    r'\1color: var(--color-on-surface);\2', html
)

# And add specific rules for #input-box
custom_css = "\n    /* Input Box Specific White Text */\n    #input-box .form-group__label,\n    #input-box .form-options__checkbox-label,\n    #input-box .scenario-accounts__title {\n      color: #fff;\n    }\n"
html = html.replace("    /*\n      -- Utility Classes (BEM) --", custom_css + "    /*\n      -- Utility Classes (BEM) --")

with codecs.open("index.html", "w", "utf-8") as f:
    f.write(html)
print("CSS injected.")
