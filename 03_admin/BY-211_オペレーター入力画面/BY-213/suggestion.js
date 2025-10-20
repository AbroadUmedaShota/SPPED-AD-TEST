document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const suggestionsModal = document.getElementById('suggestions-modal');
    const suggestionsModalInstance = M.Modal.getInstance(suggestionsModal);
    const suggestionsModalTitle = document.getElementById('suggestions-modal-title');
    const newSuggestionInput = document.getElementById('new-suggestion-input');
    const addSuggestionBtn = document.getElementById('add-suggestion-btn');
    const suggestionsList = document.getElementById('suggestions-list');
    const snippetContainer = document.getElementById('snippet-container');
    const allInputs = document.querySelectorAll('input[type=text], input[type=email], input[type=tel], input[type=url], textarea');

    let currentInputId = null;
    let activeInput = null;

    const STORAGE_KEY = 'customAutocomplete';

    // Map groups to their relevant input fields
    const groupInputMap = {
        'グループ1': ['email'],
        'グループ2': ['last-name', 'first-name'],
        'グループ3': ['company', 'department', 'position'],
        'グループ4': ['zip', 'address1', 'address2'],
        'グループ5': ['tel1', 'tel2', 'mobile', 'fax'],
        'グループ6': ['url'],
        'グループ7': ['notes'],
        'グループ8': ['free-text']
    };

    // --- LocalStorage Functions ---
    function getAllSuggestions() {
        const stored = localStorage.getItem(STORAGE_KEY);
        try {
            const parsed = JSON.parse(stored);
            return (typeof parsed === 'object' && parsed !== null) ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function getSuggestionsFor(inputId) {
        const all = getAllSuggestions();
        return all[inputId] || [];
    }

    function saveSuggestionsFor(inputId, suggestions) {
        const all = getAllSuggestions();
        all[inputId] = suggestions;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }

    function addSuggestion(inputId, value) {
        if (!value) return;
        const suggestions = getSuggestionsFor(inputId);
        if (!suggestions.includes(value)) {
            suggestions.push(value);
            saveSuggestionsFor(inputId, suggestions);
        }
    }

    function deleteSuggestion(inputId, value) {
        let suggestions = getSuggestionsFor(inputId);
        suggestions = suggestions.filter(item => item !== value);
        saveSuggestionsFor(inputId, suggestions);
    }

    // --- Modal Functions ---
    function openSuggestionsModal(inputId, inputLabel) {
        currentInputId = inputId;
        suggestionsModalTitle.textContent = `${inputLabel} の候補を管理`;
        populateSuggestionsList(inputId);
        suggestionsModalInstance.open();
    }

    function populateSuggestionsList(inputId) {
        const suggestions = getSuggestionsFor(inputId);
        suggestionsList.innerHTML = '';
        if (suggestions.length === 0) {
            suggestionsList.innerHTML = '<li class="collection-item">保存されている候補はありません。</li>';
            return;
        }
        suggestions.forEach(value => {
            const li = document.createElement('li');
            li.className = 'collection-item';
            li.innerHTML = `
                <div>
                    ${value}
                    <a href="#!" class="secondary-content delete-suggestion-btn">
                        <i class="material-icons">delete</i>
                    </a>
                </div>
            `;
            li.querySelector('.delete-suggestion-btn').addEventListener('click', () => {
                deleteSuggestion(inputId, value);
                populateSuggestionsList(inputId);
            });
            suggestionsList.appendChild(li);
        });
    }

    // --- Snippet Button Functions ---
    function updateSnippetButtonsForGroup(groupName) {
        snippetContainer.innerHTML = ''; // Clear previous buttons
        const inputIds = groupInputMap[groupName] || [];
        let allSnippets = [];

        inputIds.forEach(inputId => {
            const snippets = getSuggestionsFor(inputId);
            allSnippets.push(...snippets);
        });

        // Remove duplicates
        const uniqueSnippets = [...new Set(allSnippets)];

        if (uniqueSnippets.length > 0) {
            uniqueSnippets.forEach(snippetText => {
                const button = document.createElement('a');
                button.className = 'waves-effect waves-light btn-small blue-grey lighten-2 snippet-btn';
                button.textContent = snippetText;
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (!activeInput) return;

                    if (activeInput.id === 'email') {
                        const currentValue = activeInput.value;
                        const atIndex = currentValue.indexOf('@');
                        if (atIndex !== -1) {
                            activeInput.value = currentValue.substring(0, atIndex) + snippetText;
                        } else {
                            activeInput.value = currentValue + snippetText;
                        }
                    } else {
                        activeInput.value += snippetText;
                    }

                    M.updateTextFields();
                    activeInput.focus();
                });
                snippetContainer.appendChild(button);
            });
        }
    }
    // Expose the function to the global scope
    window.updateSnippetButtonsForGroup = updateSnippetButtonsForGroup;

    // --- Event Listeners ---
    document.querySelectorAll('.manage-suggestions-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const inputId = btn.dataset.inputId;
            const inputLabel = btn.dataset.inputLabel;
            openSuggestionsModal(inputId, inputLabel);
        });
    });

    addSuggestionBtn.addEventListener('click', () => {
        if (currentInputId) {
            const newValue = newSuggestionInput.value.trim();
            addSuggestion(currentInputId, newValue);
            populateSuggestionsList(currentInputId);
            // Refresh the buttons for the currently active group
            const activeGroupElement = document.querySelector('.group-section.active');
            if (activeGroupElement) {
                const activeGroupName = activeGroupElement.dataset.group;
                updateSnippetButtonsForGroup(activeGroupName);
            }
            newSuggestionInput.value = '';
        }
    });

    newSuggestionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSuggestionBtn.click();
        }
    });

    allInputs.forEach(input => {
        input.addEventListener('focus', () => {
            activeInput = input; // Keep track of the last focused input
        });
    });
});
