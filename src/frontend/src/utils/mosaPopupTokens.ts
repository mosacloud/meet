// Mosa-specific: shared design tokens for the profile dropdown and app
// switcher popups (MosaHomePage/ProfileDropdown.tsx and
// MosaHomePage/AppSwitcherButton.tsx). Both components build their popups
// from literal inline `style={}` objects rather than Panda CSS or SCSS, so
// the values that both need are centralized here instead of being
// duplicated in each file. Values used by only one of the two (e.g.
// ProfileDropdown's danger colors, AppSwitcherButton's `BG`) stay local to
// that file.

export const SURFACE = '#ffffff'
export const HOVER = '#eeeeee'
export const BORDER = '#e6eaf1'
export const INK = '#333333'
export const GRAPHITE = '#5a6577'
export const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
export const SHADOW =
  '0 2px 4px rgba(0,0,0,.02), 0 4px 8px rgba(0,0,0,.03), 0 8px 16px rgba(0,0,0,.04), 0 16px 32px rgba(0,0,0,.05), 0 32px 64px rgba(0,0,0,.08)'

// Breakpoint at which a popup switches from an anchored dropdown to a fixed,
// full-width sheet.
export const MOBILE_BREAKPOINT_QUERY = '(max-width: 480px)'
