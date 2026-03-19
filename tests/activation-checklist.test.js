/**
 * Activation Checklist Logic Tests
 * Item 0.3 — Post-Onboarding Activation Checklist
 *
 * Tests the 5-step checklist condition logic that drives the
 * practitioner activation plan UI.
 */
import { describe, it, expect } from 'vitest';

// Extract the checklist condition logic from renderPractitionerActivationPlan
// so we can unit-test the boolean flags independently of the DOM.
function computeActivationSteps({ rosterData, profileData, invitationsData, directoryData, metricsData }) {
  const clients = Array.isArray(rosterData?.clients) ? rosterData.clients : [];
  const invitations = Array.isArray(invitationsData?.invitations) ? invitationsData.invitations : [];
  const directoryProfile = directoryData?.profile || null;
  const stats = metricsData?.stats || {};

  const directoryReady = !!(directoryProfile?.display_name && directoryProfile?.bio && directoryProfile?.booking_url);
  const hasClientOrInvite = clients.length > 0 || invitations.length > 0;
  const chartReadyClient = clients.find(client => !!client.chart_id) || null;
  const hasFirstNote = parseInt(stats.totalNotes ?? 0) > 0;
  const sessionReadyClient = clients.find(client => !!client.chart_id && !!client.profile_id) || null;

  return [
    { key: 'profile', done: directoryReady },
    { key: 'invite', done: hasClientOrInvite },
    { key: 'chart', done: !!chartReadyClient },
    { key: 'note', done: hasFirstNote },
    { key: 'brief', done: !!sessionReadyClient },
  ];
}

describe('Activation Checklist — Step Conditions', () => {
  const EMPTY_DATA = {
    rosterData: { clients: [] },
    profileData: { practitioner: {} },
    invitationsData: { invitations: [] },
    directoryData: { error: 'Not yet configured' },
    metricsData: { stats: { totalNotes: 0, activeClients: 0 } },
  };

  it('returns 5 steps, all incomplete for a fresh practitioner', () => {
    const steps = computeActivationSteps(EMPTY_DATA);
    expect(steps).toHaveLength(5);
    expect(steps.every(s => !s.done)).toBe(true);
    expect(steps.map(s => s.key)).toEqual(['profile', 'invite', 'chart', 'note', 'brief']);
  });

  it('marks profile step done when display_name + bio + booking_url present', () => {
    const data = {
      ...EMPTY_DATA,
      directoryData: { profile: { display_name: 'Jana', bio: 'HD Analyst', booking_url: 'https://cal.com/jana' } },
    };
    const steps = computeActivationSteps(data);
    expect(steps[0]).toEqual({ key: 'profile', done: true });
    expect(steps.filter(s => s.done)).toHaveLength(1);
  });

  it('profile incomplete if booking_url missing', () => {
    const data = {
      ...EMPTY_DATA,
      directoryData: { profile: { display_name: 'Jana', bio: 'HD Analyst' } },
    };
    const steps = computeActivationSteps(data);
    expect(steps[0].done).toBe(false);
  });

  it('marks invite step done when at least one client exists', () => {
    const data = {
      ...EMPTY_DATA,
      rosterData: { clients: [{ id: 'c1', email: 'a@b.com' }] },
    };
    const steps = computeActivationSteps(data);
    expect(steps[1]).toEqual({ key: 'invite', done: true });
  });

  it('marks invite step done with pending invitations only (no accepted clients)', () => {
    const data = {
      ...EMPTY_DATA,
      invitationsData: { invitations: [{ email: 'pending@b.com', status: 'pending' }] },
    };
    const steps = computeActivationSteps(data);
    expect(steps[1].done).toBe(true);
  });

  it('marks chart step done when a client has chart_id', () => {
    const data = {
      ...EMPTY_DATA,
      rosterData: { clients: [{ id: 'c1', chart_id: 'ch1' }] },
    };
    const steps = computeActivationSteps(data);
    expect(steps[2]).toEqual({ key: 'chart', done: true });
  });

  it('chart step incomplete when client has no chart_id', () => {
    const data = {
      ...EMPTY_DATA,
      rosterData: { clients: [{ id: 'c1' }] },
    };
    const steps = computeActivationSteps(data);
    expect(steps[2].done).toBe(false);
  });

  it('marks note step done when totalNotes > 0', () => {
    const data = {
      ...EMPTY_DATA,
      metricsData: { stats: { totalNotes: 3 } },
    };
    const steps = computeActivationSteps(data);
    expect(steps[3]).toEqual({ key: 'note', done: true });
  });

  it('note step incomplete when totalNotes is 0 or missing', () => {
    const steps = computeActivationSteps(EMPTY_DATA);
    expect(steps[3].done).toBe(false);

    const noStats = computeActivationSteps({ ...EMPTY_DATA, metricsData: null });
    expect(noStats[3].done).toBe(false);
  });

  it('marks brief step done when a client has both chart_id AND profile_id', () => {
    const data = {
      ...EMPTY_DATA,
      rosterData: { clients: [{ id: 'c1', chart_id: 'ch1', profile_id: 'pr1' }] },
    };
    const steps = computeActivationSteps(data);
    expect(steps[4]).toEqual({ key: 'brief', done: true });
  });

  it('brief step incomplete when client has chart but no profile', () => {
    const data = {
      ...EMPTY_DATA,
      rosterData: { clients: [{ id: 'c1', chart_id: 'ch1' }] },
    };
    const steps = computeActivationSteps(data);
    expect(steps[4].done).toBe(false);
  });

  it('fully activated practitioner has all 5 steps done', () => {
    const data = {
      rosterData: { clients: [{ id: 'c1', chart_id: 'ch1', profile_id: 'pr1' }] },
      profileData: { practitioner: { display_name: 'Jana' } },
      invitationsData: { invitations: [] },
      directoryData: { profile: { display_name: 'Jana', bio: 'Expert', booking_url: 'https://cal.com/jana' } },
      metricsData: { stats: { totalNotes: 5, activeClients: 1 } },
    };
    const steps = computeActivationSteps(data);
    expect(steps.every(s => s.done)).toBe(true);
    expect(steps.filter(s => s.done)).toHaveLength(5);
  });

  it('handles null/undefined data gracefully', () => {
    const steps = computeActivationSteps({});
    expect(steps).toHaveLength(5);
    expect(steps.every(s => !s.done)).toBe(true);
  });
});
