import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('guidance regression harness', () => {
  it('keeps the required shell guidance anchors in the SPA shell', () => {
    const indexHtml = read('frontend/index.html');

    expect(indexHtml).toContain('id="shellOrientationStrip"');
    expect(indexHtml).toContain('id="step-guide-banner"');
    expect(indexHtml).toContain('Start with your chart');
    expect(indexHtml).toContain('id="accountMenuWrap"');
    expect(indexHtml).toContain('id="accountMenuBtn"');
    expect(indexHtml).toContain('id="accountMenuPanel"');
    expect(indexHtml).toContain('id="chartGuidanceStrip"');
    expect(indexHtml).toContain('id="chartGuidancePanel"');
    expect(indexHtml).toContain('id="chartGuidanceNextStep"');
    expect(indexHtml).toContain('id="profileGuidanceStrip"');
    expect(indexHtml).toContain('id="profileGuidancePanel"');
    expect(indexHtml).toContain('id="profileGuidanceNextStep"');
    expect(indexHtml).toContain('id="profileBirthDataSummaryCard"');
    expect(indexHtml).toContain('id="profileBirthDataFields" hidden');
    expect(indexHtml).toContain('id="pracActivationPlan"');
    expect(indexHtml).toContain('id="practitionerCardIntro"');
  });

  it('keeps deterministic shell orchestration hooks in app runtime', () => {
    const appJs = read('frontend/js/app.js');

    expect(appJs).toContain('function getGuidanceState()');
    expect(appJs).toContain('function updateAccountMenuVisibility()');
    expect(appJs).toContain('function updateProfileBirthDataShell()');
    expect(appJs).toContain('function updateShellChrome(');
    expect(appJs).toContain('const CORE_JOURNEY_TABS = new Set');
    expect(appJs).toContain('journeyGuide.hidden = !showJourney;');
    expect(appJs).toContain('socialProofBanner.hidden = tabId !== \'overview\';');
    expect(appJs).toContain('if (!e.target.closest(\'#accountMenuWrap\')) closeAccountMenu();');
    expect(appJs).toContain('updateShellChrome();');
  });

  it('documents the manual and checklist gates for repeated loops', () => {
    const checklist = read('docs/guidance-regression-checklist.md');
    const manualScript = read('docs/guidance-manual-test-script.md');

    expect(checklist).toContain('npm run test:guidance');
    expect(checklist).toContain('GUIDE-003');
    expect(checklist).toContain('GUIDE-005');
    expect(manualScript).toContain('Flow 1: First-Time Personal User');
    expect(manualScript).toContain('Flow 3: Practitioner User');
    expect(manualScript).toContain('chart -> profile -> transits');
  });
});