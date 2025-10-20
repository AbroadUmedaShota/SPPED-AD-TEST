document.addEventListener('DOMContentLoaded', function() {
    const suggestions = {
        'email': [
            '@gmail.com', '@yahoo.co.jp', '@outlook.com', '@icloud.com', 
            '@docomo.ne.jp', '@softbank.ne.jp', '@ezweb.ne.jp'
        ],
        'company': [
            '株式会社', '有限会社', '合同会社', '(株)', '(有)'
        ]
    };

    function createSuggestionButtons(inputId, suggestionList) {
        const inputElement = document.getElementById(inputId);
        if (!inputElement) return;

        const container = document.createElement('div');
        container.className = 'suggestion-container';
        container.style.marginTop = '5px';
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '5px';

        suggestionList.forEach((text, index) => {
            const button = document.createElement('a');
            button.href = '#!';
            button.className = 'waves-effect waves-light btn-small blue-grey lighten-2';
            // Add number for shortcut
            button.textContent = `[${index + 1}] ${text}`;
            button.style.textTransform = 'none';

            button.addEventListener('click', (e) => {
                e.preventDefault();
                let currentValue = inputElement.value;
                
                if (inputId === 'email') {
                    const atIndex = currentValue.indexOf('@');
                    if (atIndex !== -1) {
                        currentValue = currentValue.substring(0, atIndex);
                    }
                    inputElement.value = currentValue + text;
                } else if (inputId === 'company') {
                    if (text.startsWith('(')) {
                         inputElement.value = text + currentValue;
                    } else {
                         inputElement.value = currentValue + text;
                    }
                }
                
                M.updateTextFields();
                inputElement.focus();
            });
            container.appendChild(button);
        });

        inputElement.parentElement.insertAdjacentElement('afterend', container);

        // Add keydown listener for shortcuts
        inputElement.addEventListener('keydown', (e) => {
            // Use Alt + Number for shortcuts
            if (e.altKey && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const buttonIndex = parseInt(e.key, 10) - 1;
                
                if (buttonIndex < suggestionList.length) {
                    const buttons = container.querySelectorAll('a');
                    if (buttons[buttonIndex]) {
                        buttons[buttonIndex].click();
                    }
                }
            }
        });
    }

    createSuggestionButtons('email', suggestions.email);
    createSuggestionButtons('company', suggestions.company);
});