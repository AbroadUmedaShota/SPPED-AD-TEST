### Pre-investigation Summary
The user pointed out that the Survey Duplication Modal (`duplicateSurveyModal`) still uses the old text-based help buttons, and that the New Survey Modal might not be updated either (likely due to viewing cached/unmerged state, but will verify).
The previous fix only addressed `newSurveyModal`. This task is to apply the same UI/UX updates to `duplicateSurveyModal`.

**Files to be changed:**
- `02_dashboard/modals/duplicateSurveyModal.html`: Replace text buttons with icon buttons and add popover HTML.
- `02_dashboard/src/duplicateSurveyModal.js`: Add logic to toggle the popovers.

### Contribution to Project Goals
Consistent UI/UX across all modals (New, Detail, Duplicate).

### Overview of Changes
1.  **HTML**: Replace "What is the difference?" text buttons with `help_outline` icons and add hidden popover divs in `duplicateSurveyModal.html`.
2.  **JS**: Implement popover toggle logic in `duplicateSurveyModal.js` similar to `surveyDetailsModal.js` and `main.js`.

### Specific Work Content for Each File
- `02_dashboard/modals/duplicateSurveyModal.html`:
    - Replace `.survey-help-trigger` buttons with `.help-icon-button`.
    - Add `.help-popover` divs with unique IDs (e.g., `duplicate-survey-name-tooltip`).
- `02_dashboard/src/duplicateSurveyModal.js`:
    - Add `activeDuplicateSurveyPopover` state variable.
    - Add `closeDuplicateSurveyPopover` function.
    - In `setupEventListeners` (or `openDuplicateSurveyModal`), add click listeners to the new help icons.
    - Add global click/keydown listeners to close the popover (scoped/managed carefully to avoid conflicts).

### Definition of Done
- [ ] Duplicate Survey Modal displays "?" icons.
- [ ] Clicking the icon toggles the popover with correct text.
- [ ] Clicking outside closes the popover.
- [ ] (Re-verify) New Survey Modal works as expected.