const fs = require('fs');
const path = require('path');

describe('manifest.json', () => {
  let manifest;

  beforeAll(() => {
    const manifestPath = path.join(__dirname, '..', 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
  });

  test('should have required fields', () => {
    expect(manifest).toHaveProperty('manifest_version');
    expect(manifest).toHaveProperty('name');
    expect(manifest).toHaveProperty('version');
    expect(manifest).toHaveProperty('description');
  });

  test('should use manifest version 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('should have proper permissions', () => {
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
  });

  test('should have host permissions for GitHub', () => {
    expect(manifest.host_permissions).toContain('https://api.github.com/*');
    expect(manifest.host_permissions).toContain('https://github.com/*');
  });

  test('should have content scripts configuration', () => {
    expect(manifest.content_scripts).toBeDefined();
    expect(Array.isArray(manifest.content_scripts)).toBe(true);
    expect(manifest.content_scripts.length).toBeGreaterThan(0);
  });

  test('should have background script configuration', () => {
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBeDefined();
  });

  test('should have action configuration for popup', () => {
    expect(manifest.action).toBeDefined();
    expect(manifest.action.default_popup).toBeDefined();
    expect(manifest.action.default_title).toBeDefined();
  });

  test('should not have icons defined (for simplicity)', () => {
    expect(manifest.icons).toBeUndefined();
  });

  test('should not have options page defined initially', () => {
    expect(manifest.options_page).toBeUndefined();
  });
});