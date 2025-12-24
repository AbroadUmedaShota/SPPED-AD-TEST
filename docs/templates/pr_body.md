### Pull Request Description
This PR addresses the issue where clicking the business card image in the Speed Review modal causes the application to freeze.

**Changes:**
- Refactored `02_dashboard/src/ui/speedReviewRenderer.js` to remove inline `onclick` attributes from the HTML string generation.
- Implemented `setupCardZoomListeners` to attach event listeners to business card images after they are rendered in the DOM.
- Refactored `openCardZoom` to be a local exported function instead of a global `window` property.
- Updated `02_dashboard/src/speed-review.js` to call `setupCardZoomListeners` after rendering the modal content.

**Testing:**
- Verified that clicking the business card image opens the zoom overlay without freezing.
- Verified that the zoom overlay can be closed.
- Confirmed that toggling edit mode in the modal works correctly and re-attaches zoom listeners.

**Related Issue:** #186