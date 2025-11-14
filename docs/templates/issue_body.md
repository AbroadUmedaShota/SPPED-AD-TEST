### Description

This issue addresses two problems in the tutorial on the `surveyCreation.html` page.

1.  **Preview screen not highlighted:** During the tutorial, the preview screen is not highlighted (dimmed) as an overlay, which makes it difficult for users to focus on the target element.
2.  **Browser modal on exit:** After completing the tutorial, clicking the "Return to Dashboard" button triggers an unnecessary browser confirmation modal ("Are you sure you want to leave?"). This should be suppressed to allow for direct navigation.

### Pre-investigation Summary

- The target file is `02_dashboard/surveyCreation.html`.
- The related JavaScript file is likely `02_dashboard/src/surveyCreationTutorial.js` or a similar file that controls the tutorial's behavior.
- The browser confirmation modal is probably caused by a `beforeunload` event listener, which should be conditionally disabled during or after the tutorial.

### Acceptance Criteria

- The preview screen is correctly highlighted with an overlay during the relevant tutorial step.
- Clicking "Return to Dashboard" after the tutorial navigates the user directly to the dashboard without any confirmation modal.
