### Pre-investigation Summary
The user reported that the help tooltips in the "New Survey Modal" are not working, although the "Duplicate Survey Modal" ones are.
Investigation revealed that the "New Survey" button in `main.js` calls `handleOpenModal` directly, bypassing `openNewSurveyModalWithSetup` which contains the logic for initializing the help popovers (and the date picker).

**Files to be changed:**
- `02_dashboard/src/main.js`: Update the event listener for `#openNewSurveyModalBtn` to call `openNewSurveyModalWithSetup()` instead of `handleOpenModal(...)`.

### Contribution to Project Goals
Ensures the New Survey Modal is fully initialized with all required functionality (help tooltips, date pickers, validation).

### Overview of Changes
- Change the click handler for `#openNewSurveyModalBtn` in `main.js` to invoke the setup function.

### Specific Work Content for Each File
- `02_dashboard/src/main.js`:
    - Locate the event listener for `openNewSurveyModalBtn`.
    - Change the callback to call `openNewSurveyModalWithSetup()`.

### Definition of Done
- [ ] Clicking "Create New Survey" opens the modal.
- [ ] value help icons work (popovers appear).
- [ ] Date picker works (as it was also in that setup function).