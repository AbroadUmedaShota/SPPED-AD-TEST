### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- Checked `duplicateSurveyModal.html` and confirmed it still uses the old text link style.
- Checked `duplicateSurveyModal.js` and confirmed it lacks the new popover logic.

**Files to be changed:**
- `02_dashboard/modals/duplicateSurveyModal.html`
- `02_dashboard/src/duplicateSurveyModal.js`

#### 2. **Contribution to Project Goals**
- Standardizes UI across all survey-related modals.

#### 3. **Overview of Changes**
- Apply the same pattern used in Issue #147 to the Duplicate Survey Modal.

#### 4. **Specific Work Content for Each File**
- `02_dashboard/modals/duplicateSurveyModal.html`:
    - Replace the text help button with `<button class="help-icon-button ...">help_outline</button>`.
    - Add the popover `<div ...>` structure with IDs `duplicate-survey-name-tooltip` and `duplicate-display-title-tooltip`.
- `02_dashboard/src/duplicateSurveyModal.js`:
    - Insert logic to handle popover toggling (open/close on click, close on outside click/Escape).
    - Ensure variables are scoped correctly to not interfere with other modals.

#### 5. **Definition of Done**
- [ ] Duplicate Survey Modal has "?" icons.
- [ ] Popovers appear on click with correct text.
- [ ] Popovers close correctly.

---
If you approve, please reply to this comment with "Approve".