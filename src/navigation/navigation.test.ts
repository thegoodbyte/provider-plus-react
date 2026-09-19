import { canShowNavigation, NAVIGATION, readNavigationPreferences } from './navigation';

beforeEach(() => localStorage.clear());

it('respects route-to-role preferences and supported legacy role-to-route preferences', () => {
  expect(canShowNavigation('payment-requests', 'admin', { 'payment-requests': [] })).toBe(false);
  expect(canShowNavigation('clients', 'medical_staff', { clients: ['medical_staff'] })).toBe(true);
  expect(canShowNavigation('communications', 'medical_staff', { medical_staff: ['clients'] })).toBe(false);
  expect(canShowNavigation('review-requests', 'medical_advisor', { 'medical-review-requests': ['medical_advisor'] })).toBe(true);
});

it('never grants administration or setup access through stored preferences', () => {
  expect(canShowNavigation('users', 'facilitator', { users: ['facilitator'] })).toBe(false);
  expect(canShowNavigation('retreat-flow', 'medical_advisor', { medical_advisor: ['retreat-flow'] })).toBe(false);
  expect(canShowNavigation('users', 'unknown')).toBe(false);
  expect(canShowNavigation('users', undefined)).toBe(false);
  expect(canShowNavigation('medical-review-requests', 'medical_advisor')).toBe(true);
});

it('handles corrupt preference storage and separates setup from daily work', () => {
  localStorage.setItem('navigationPermissions:v1', '{broken');
  expect(readNavigationPreferences()).toEqual({});
  expect(NAVIGATION['retreat-flow-library'].setup).toBe(true);
  expect(NAVIGATION['booking-document-types'].setup).toBe(true);
  expect(NAVIGATION['retreat-flow'].setup).toBe(true);
  expect(NAVIGATION['booking-flow'].setup).toBeUndefined();
  expect(NAVIGATION.workflow.setup).toBeUndefined();
});
