# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension project that provides a sidebar interface for viewing GitHub Issues and Pull Requests. The extension allows users to efficiently browse and manage GitHub content without navigating away from their current page.

## Development Commands

Since this is a Chrome extension project, development is primarily file-based without build tools. The extension can be loaded directly into Chrome for testing:

1. **Load Extension for Testing:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory
   - Reload the extension after making changes

2. **Debugging:**
   - Use Chrome DevTools for debugging content scripts and sidebar
   - Access background script logs via `chrome://extensions/` → "Inspect views: background page"
   - Use `console.log()` statements for debugging during development

## Architecture

### Core Components

- **`manifest.json`** - Chrome extension configuration, permissions, and entry points
- **`background.js`** - Background service worker handling API calls and cross-tab communication
- **`content.js`** - Content script injected into web pages to create sidebar interface
- **`sidebar/`** - Sidebar UI components (HTML, CSS, JavaScript)
- **`popup/`** - Extension popup interface for quick settings
- **`options/`** - Extension options/settings page

### Key Architectural Patterns

1. **Message Passing:** Communication between content script, background script, and sidebar uses Chrome's message passing API
2. **GitHub API Integration:** Background script handles all GitHub API calls to avoid CORS issues
3. **Storage Management:** Chrome Storage API for persisting user settings and cached data
4. **Modular UI:** Sidebar components are organized as separate modules for maintainability

### Authentication Flow

The extension uses GitHub Personal Access Tokens for API authentication:
1. User provides token through options page
2. Token is securely stored using Chrome Storage API
3. Background script includes token in API request headers
4. All API calls are proxied through background script

### Data Flow

1. Content script creates and manages sidebar DOM element
2. Sidebar UI requests data through message passing to background script
3. Background script fetches data from GitHub API
4. Results are passed back to sidebar for display
5. Local caching reduces API calls and improves performance

## Security Considerations

- Never store GitHub tokens in plaintext or commit them to version control
- Validate all user inputs before making API calls
- Use Chrome's built-in CSP protection for the extension
- Sanitize any GitHub content before rendering in the sidebar

## GitHub API Usage

- Use GitHub REST API v3 for primary functionality
- Implement proper rate limiting and error handling
- Cache responses when appropriate to reduce API calls
- Support both public and private repositories based on token permissions