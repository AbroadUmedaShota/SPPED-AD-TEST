
document.addEventListener('DOMContentLoaded', () => {

    const snippets = {
        'グループ1': {
            'email': ['@gmail.com', '@yahoo.co.jp', '@outlook.com', '@icloud.com', '@docomo.ne.jp', '@softbank.ne.jp', '@ezweb.ne.jp', '@au.com']
        },
        'グループ3': {
            'company': ['株式会社', '有限会社', '合同会社', '(株)', '(有)'],
            'department': ['営業部', '開発部', '総務部', '人事部', 'マーケティング部'],
            'position': ['代表取締役', '取締役', '部長', '課長', '係長', '主任']
        },
        'グループ6': {
            'url': ['https://', 'http://', 'www.']
        }
    };

    function createSnippetButton(targetInput, text, index) {
        const button = document.createElement('a');
        button.href = '#!';
        button.className = 'btn-small waves-effect waves-light blue-grey lighten-3 tooltipped';
        button.setAttribute('data-position', 'bottom');
        button.setAttribute('data-tooltip', `Alt+${index + 1} で入力`);
        button.textContent = `[${index + 1}] ${text}`;
        button.style.textTransform = 'none';
        button.style.margin = '2px';

        button.addEventListener('click', (e) => {
            e.preventDefault();
            targetInput.value = text;

            M.updateTextFields();
            targetInput.focus();
        });
        return button;
    }

    window.updateSnippetButtonsForGroup = (groupName) => {
        // Remove any existing snippet containers
        document.querySelectorAll('.snippet-container').forEach(container => {
            container.remove();
        });

        const groupSnippets = snippets[groupName];
        if (!groupSnippets) return;

        const activeGroupSection = document.querySelector(`.group-section[data-group="${groupName}"]`);
        if (!activeGroupSection) return;

        for (const inputId in groupSnippets) {
            const targetInput = activeGroupSection.querySelector(`#${inputId}`);
            if (targetInput) {
                const suggestions = groupSnippets[inputId];
                
                const container = document.createElement('div');
                container.className = 'snippet-container'; 
                container.style.padding = '10px 0';

                suggestions.forEach((text, index) => {
                    const button = createSnippetButton(targetInput, text, index);
                    container.appendChild(button);
                });

                // Add shortcut listener only once
                if (!targetInput.dataset.shortcutListenerAttached) {
                    targetInput.addEventListener('keydown', (e) => {
                        if (e.altKey && e.key >= '1' && e.key <= '9') {
                            e.preventDefault();
                            const buttonIndex = parseInt(e.key, 10) - 1;
                            const activeGroup = document.querySelector('.group-section.active');
                            const currentInputId = document.activeElement.id;

                            // Find the container associated with the currently focused input
                            const currentContainer = document.activeElement.parentElement.nextElementSibling;

                            if (currentContainer && currentContainer.classList.contains('snippet-container')) {
                                const buttons = currentContainer.querySelectorAll('a');
                                if (buttonIndex < buttons.length && buttons[buttonIndex]) {
                                    buttons[buttonIndex].click();
                                }
                            }
                        }
                    });
                    targetInput.dataset.shortcutListenerAttached = 'true';
                }
                
                // Insert after the input-field container
                targetInput.parentElement.insertAdjacentElement('afterend', container);

                // 新しく追加されたツールチップを初期化
                const newTooltips = container.querySelectorAll('.tooltipped');
                M.Tooltip.init(newTooltips);
            }
        }
    };
});
