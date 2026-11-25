# Design Guide

## 1. Design direction
Use the approved visual direction from the initial mockup: clean, modern academic, premium, calm, and minimal.

The interface should feel like a polished macOS productivity/study application rather than a playful game.

## 2. Color direction
Pink is the accent color. Prefer a restrained palette:
- Soft blush / pale pink for subtle selected backgrounds.
- Medium rose for primary actions and active states.
- Deeper rose for emphasis and focus indicators.
- Warm white or very light neutral for main surfaces.
- Charcoal / near-black for primary text.
- Muted gray for secondary text and borders.

Do not make every surface pink. Use pink selectively for primary buttons, selected answers, progress indicators, icons, focus, and active navigation.

Create named design tokens (CSS variables or Tailwind theme values) rather than scattering hex values through components. Ensure accessible contrast, especially for small text and disabled controls.

## 3. Layout and components
- macOS-friendly desktop layout with a clear content hierarchy.
- Consistent spacing, rounded cards, subtle borders, and restrained shadows.
- Main menu: six clear navigation tiles; no stats, recommendations, streaks, weak areas, or study prompts.
- Practice screen: question content is the focus; keep timer, progress, bookmark, answer selection, and navigation easy to find.
- Reading screen: passage and questions should be readable together; allow a practical split layout.
- Statistics: separate page with charts and filters.
- Use consistent button, card, answer-choice, timer, modal, and navigation components.

## 3A. Settings and question import experience
Settings is opened from the gear icon. Add a **Question Bank Management** area with a clearly labeled **Import Questions** action; do not add import to the six-item main navigation.

The import flow should use a simple step-by-step layout:
- **Choose file:** explain that the app accepts its versioned JSON question-package format and works offline.
- **Validation:** show progress and clear, human-readable errors; do not expose raw stack traces as the primary message.
- **Preview:** show package identity/version, total items, LR/RC counts, passage/category counts, duplicates, and warnings before any database changes.
- **Confirmation:** state that approved new content will be added and existing content/user progress will not be overwritten.
- **Result:** report imported and skipped counts, or explain why the entire transaction was rolled back.

Use the existing restrained rose accent for the primary Import/Confirm action. Destructive-looking or irreversible actions should not be implied; normal import is additive and must not offer a delete/reset shortcut.


## 4. Typography
Prioritize reading comfort. Use a clean UI font for controls and labels. Use a highly readable text style for long passages and question stems. Avoid overly decorative typography.

## 5. Interaction rules
- Selected answer must be visually obvious.
- Keyboard navigation should be supported where practical.
- Flag/bookmark state should be visible.
- Timer should remain legible without dominating the page.
- Show confirmation before deleting saved data or resetting progress.
- Provide empty states when no bookmarks, attempts, or statistics exist.
- Avoid fake metrics or placeholder numbers in the shipped app.

## 6. Initial screen concepts
### Main menu
Title and settings icon, then six destinations:
- Logical Reasoning
- Reading Comprehension
- Custom Practice
- Practice Tests
- Review
- Statistics

### Logical Reasoning practice
- Back/navigation control.
- Section/category label.
- Question progress and timer when timed.
- Bookmark control.
- Prompt and five answer choices.
- Previous/next navigation.
- Explanation shown according to session settings.

### Statistics
- Summary metrics at top.
- LR/RC comparison.
- Category and difficulty breakdown.
- Trend over time.
- Session and test history.

## 7. Responsive behavior
The initial target is a Mac desktop window. Still handle window resizing gracefully. Do not assume a fixed screen resolution. Make long passages and answer choices scroll naturally without hiding primary controls.
