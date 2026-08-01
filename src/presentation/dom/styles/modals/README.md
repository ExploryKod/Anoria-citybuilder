# Modals CSS Organization

This directory contains modularized CSS files for all modal components in the application.

## File Structure

### Core Modal Files
- `global.css` - Common styles and utilities shared across all modals
- `realtime-budget.css` - Real-time budget popup styles
- `compte-de-resultat-panel.css` - Compte de résultat panel styles
- `bilan-panel.css` - Bilan comptable (balance sheet) panel styles
- `loans-panel.css` - Loans panel styles

### Content-Specific Files
- `bilan-panel-content.css` - Bilan panel content styles
- `compte-de-resultat-panel-content.css` - Compte de résultat content styles
- `balance-sheet.css` - Balance sheet styles
- `cleanup-notification.css` - Cleanup notification styles

## Usage

Each modal file should be imported in the main HTML file or through a CSS bundler:

```html
<!-- Core modal styles -->
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/global.css">
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/realtime-budget.css">
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/compte-de-resultat-panel.css">
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/bilan-panel.css">
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/loans-panel.css">

<!-- Content-specific styles -->
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/bilan-panel-content.css">
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/compte-de-resultat-panel-content.css">
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/balance-sheet.css">
<link rel="stylesheet" href="./src/presentation/dom/styles/modals/cleanup-notification.css">
```

## Global Styles

The `global.css` file contains:
- Common scrollbar styles for all modals
- Common animations (slideInRight, slideInLeft, fadeIn, pulse)
- Common button styles (modal-btn, modal-close-btn)
- Common layout styles (modal-header, modal-content, modal-wrapper)
- Common section and item styles

## Modal-Specific Styles

Each modal file contains:
- Panel positioning and sizing
- Panel-specific scrollbar styles
- Panel-specific animations and transitions
- Panel-specific content styling
- Panel-specific interactive elements

## Benefits

- **Modularity**: Each modal can be styled independently
- **Maintainability**: Easy to locate and modify specific modal styles
- **Reusability**: Common styles are shared through global.css
- **Performance**: Only load the CSS needed for specific modals
- **Organization**: Clear separation of concerns
