### Pre-investigation Summary
The user requested to update the help text and behavior for "Questionnaire Name" and "Display Title" in the New Survey Modal to match the Survey Details Modal.
Currently, the New Survey Modal uses a text button ("What is the difference?") and Tippy.js tooltips. The Survey Details Modal uses a "?" icon and a custom popover with specific text.

**Files to be changed:**
- `02_dashboard/modals/newSurveyModal.html`: Update the HTML structure of the help buttons to matching the icon-only style and add the popover elements.
- `02_dashboard/src/main.js`: Update the `openNewSurveyModalWithSetup` function to implement the popover logic (toggle visibility) instead of initializing Tippy.js, and remove the old text strings.

### Contribution to Project Goals
Consistency in UI/UX across modals improves usability and reduces cognitive load for the user.

### Overview of Changes
1.  **HTML**: Replace the text-based help buttons with `help_outline` icon buttons. Add hidden popover `div`s with the requested text.
2.  **JS**: Implement the click/hover logic to show/hide the popovers in `main.js`, replicating the behavior from `surveyDetailsModal.js`.

### Specific Work Content for Each File
- `02_dashboard/modals/newSurveyModal.html`:
    - Replace `<button ...>...<span>Text</span>...</button>` with `<button class="help-icon-button ...">help_outline</button>`.
    - Add `<div id="..." class="help-popover ...">...</div>` for both fields.
- `02_dashboard/src/main.js`:
    - Remove the `tippy` initialization in `openNewSurveyModalWithSetup`.
    - Add event listeners for the new `.help-icon-button` elements to toggle the corresponding popovers.
    - Implement `closeActiveHelpPopover` logic similar to `surveyDetailsModal.js` to handle closing when clicking outside.

### Definition of Done
- [ ] The New Survey Modal displays "?" icons instead of "What is the difference?" text buttons.
- [ ] Clicking/Hovering the "?" icon shows a popover with the correct text.
    - Survey Name: "社内向けの管理名称です。回答者には表示されません。"
    - Display Title: "回答者に表示されるタイトルです。イベント名等、外部向けの名称を設定してください。"
- [ ] The popover style matches the Survey Details Modal.
- [ ] Clicking outside closes the popover.