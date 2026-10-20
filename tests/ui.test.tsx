import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { AppData } from '../src/model';

// Simulated DOM integration tests: no browser, network, or native runtime.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLDialogElement', 'Event', 'MouseEvent', 'FormData', 'File', 'localStorage'] as const) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollTo = () => {};
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };

// ReactDOM and Capacitor must initialize after window and localStorage exist.
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { Preferences } = await import('@capacitor/preferences');
const { default: App } = await import('../src/App');
const { sampleData, places, validateAppData } = await import('../src/model');
const storageKey = 'naekivo-trips-v1';
const container = document.getElementById('root')!;
let root: Root | undefined;
const emptyData = (): AppData => ({ trips: [], savedPlaceIds: [], preferences: { name: '', largeText: false, highContrast: false } });
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function settle() { await act(async () => { await tick(); }); }
async function mount() {
  root = createRoot(container);
  await act(async () => { root!.render(createElement(App)); await tick(); });
  await settle();
  assert.match(container.textContent ?? '', /Saved on this device/);
}
async function reload() {
  await act(async () => { root?.unmount(); });
  root = undefined;
  await mount();
}
async function seed(data: AppData) {
  await Preferences.set({ key: storageKey, value: JSON.stringify(data) });
  await mount();
}
async function stored(): Promise<AppData> {
  await settle();
  const { value } = await Preferences.get({ key: storageKey });
  assert.ok(value, 'App state should be persisted');
  const parsed: unknown = JSON.parse(value);
  assert.ok(validateAppData(parsed), 'Every saved UI state must pass the backup validator');
  return parsed;
}
function element<T extends Element = HTMLElement>(selector: string, scope: ParentNode = container): T {
  const result = scope.querySelector<T>(selector);
  assert.ok(result, `Missing element: ${selector}`);
  return result;
}
function button(label: string, scope: ParentNode = container): HTMLButtonElement {
  const result = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(candidate =>
    (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === label);
  assert.ok(result, `Missing button: ${label}`);
  return result;
}
async function click(target: HTMLElement) {
  await act(async () => { target.click(); await tick(); });
  await settle();
}
async function setValue(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = target instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(target, value);
  await act(async () => {
    target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    await tick();
  });
}
async function fill(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    await setValue(element<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`dialog [name="${name}"]`), value);
  }
}
async function submit() {
  const form = element<HTMLFormElement>('dialog form');
  assert.ok(form.checkValidity(), 'Test form should satisfy browser constraints');
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick(); });
  await settle();
}
async function navigate(label: string) {
  const target = [...container.querySelectorAll<HTMLButtonElement>('.sidebar .nav-link')].find(candidate =>
    candidate.textContent?.trim() === label || candidate.querySelector('span')?.textContent === label);
  assert.ok(target, `Missing navigation destination: ${label}`);
  await click(target);
}

beforeEach(async () => {
  dom.window.localStorage.clear();
  document.documentElement.className = '';
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
});
after(() => { dom.window.close(); });

test('create a trip, add an activity, edit group cost, and reload persisted plans', { concurrency: false }, async () => {
  await seed(emptyData());
  await click(button('New trip'));
  assert.equal(element<HTMLInputElement>('dialog [name="travelers"]').max, '20');
  await fill({ title: 'Family coast weekend', destination: 'Destin, Florida', startDate: '2026-11-06', endDate: '2026-11-08', travelers: '3', budget: '900' });
  await submit();
  assert.equal(container.querySelector('dialog'), null);
  assert.match(container.textContent ?? '', /Family coast weekend/);
  await click(button('Add activity'));
  await fill({ title: 'Harbor lunch', category: 'food', time: '12:30', duration: '60', cost: '72.50', travelMinutes: '20', notes: 'Window table, if available.' });
  await submit();
  assert.match(element('.day-heading').textContent ?? '', /1 activities.*\$72\.50/);
  await click(button('Edit Harbor lunch'));
  await fill({ cost: '85.25' });
  await submit();
  const saved = await stored();
  assert.equal(saved.trips.length, 1);
  assert.equal(saved.trips[0].travelers, 3);
  assert.equal(saved.trips[0].days.length, 3);
  assert.deepEqual(saved.trips[0].days[0].activities.map(({ title, time, cost, notes }) => ({ title, time, cost, notes })), [
    { title: 'Harbor lunch', time: '12:30', cost: 85.25, notes: 'Window table, if available.' },
  ]);
  await reload();
  await navigate('My itinerary');
  assert.match(element('.day-heading').textContent ?? '', /1 activities.*\$85\.25/);
  await navigate('Trip budget');
  assert.equal(element('.budget-total h2').textContent, '$85.25');
  assert.deepEqual(await stored(), saved);
});

test('catalog costs scale to the group and a saved bookmark survives reload', { concurrency: false }, async () => {
  const initial = structuredClone(sampleData);
  initial.trips[0].travelers = 3;
  initial.trips[0].days[0].activities = [];
  initial.savedPlaceIds = [];
  await seed(initial);
  await navigate('Discover');
  const cafe = places.find(place => place.id === 'harbor-cafe')!;
  const card = button(`Save ${cafe.title}`).closest('article')!;
  assert.match(element('.place-bottom', card).textContent ?? '', /~\$24\s*\/ person/);
  await click(button(`Save ${cafe.title}`));
  assert.equal(button(`Unsave ${cafe.title}`).getAttribute('aria-pressed'), 'true');
  await click(button(`Add ${cafe.title} to itinerary`));
  assert.equal((await stored()).trips[0].days[0].activities[0].cost, 72);
  await reload();
  await navigate('Saved places');
  assert.equal(container.querySelectorAll('.place-card').length, 1);
  assert.equal(element('.place-card h3').textContent, cafe.title);
  assert.equal(button(`Unsave ${cafe.title}`).getAttribute('aria-pressed'), 'true');
  await click(button(`Unsave ${cafe.title}`));
  await reload();
  assert.deepEqual((await stored()).savedPlaceIds, []);
});

test('weather scenarios preserve the plan until an alternative is explicitly applied', { concurrency: false }, async () => {
  await seed(structuredClone(sampleData));
  const baseline = await stored();
  await setValue(element<HTMLSelectElement>('#condition'), 'heat');
  assert.deepEqual(await stored(), baseline);
  await click(button('Explore alternatives'));
  assert.ok(container.querySelectorAll('.suggestion').length > 0);
  await click(button('Clear skies', element('dialog')));
  assert.equal(container.querySelectorAll('.suggestion').length, 0);
  assert.deepEqual(await stored(), baseline);
  await click(button('Rainy day', element('dialog')));
  const suggestion = element('.suggestion');
  const replacementTitle = element('.swap-line strong', suggestion).textContent;
  assert.deepEqual(await stored(), baseline);
  await click(button('Use this idea', suggestion));
  const updated = await stored();
  const before = baseline.trips[0].days[0].activities;
  const after = updated.trips[0].days[0].activities;
  assert.equal(after.length, before.length);
  assert.deepEqual(after.map(activity => activity.id), before.map(activity => activity.id));
  assert.equal(after.filter((activity, index) => activity.title !== before[index].title).length, 1);
  const changed = after.find((activity, index) => activity.title !== before[index].title)!;
  assert.equal(changed.title, replacementTitle);
  assert.equal(changed.indoor, true);
  assert.equal(changed.time, before.find(activity => activity.id === changed.id)!.time);
  await reload();
  assert.deepEqual(await stored(), updated);
});

test('malformed backup imports leave existing trips and preferences intact', { concurrency: false }, async () => {
  await seed(structuredClone(sampleData));
  await navigate('Settings');
  const original = await stored();
  for (const contents of ['{"broken":', JSON.stringify({ ...original, trips: [{ ...original.trips[0], travelers: 0 }] })]) {
    const input = element<HTMLInputElement>('input[type="file"]');
    const file = new File([contents], 'invalid-backup.json', { type: 'application/json' });
    // jsdom 26 does not implement File.text; this is the browser API used by App.
    Object.defineProperty(file, 'text', { value: async () => contents });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await tick(); });
    assert.ok(container.querySelector('[role="status"]'), 'Import should report the failure');
    assert.deepEqual(await stored(), original);
  }
  assert.match(element('[role="status"]').textContent ?? '', /not a valid Naekivo Trips backup/);
  await reload();
  assert.deepEqual(await stored(), original);
});

test('deleting the last trip remains empty after reload and clearing data resets everything', { concurrency: false }, async () => {
  await seed(structuredClone(sampleData));
  await click(button('Edit details'));
  await click(button('Delete trip', element('dialog')));
  assert.match(element('dialog').textContent ?? '', /Let this trip go/);
  assert.equal((await stored()).trips.length, 1, 'Opening confirmation must not delete');
  await click(button('Delete trip', element('dialog')));
  assert.equal((await stored()).trips.length, 0);
  await reload();
  assert.match(container.textContent ?? '', /Where will your next story begin/);
  assert.equal((await stored()).trips.length, 0);
  await navigate('Settings');
  await setValue(element<HTMLInputElement>('input[placeholder="Your first name"]'), 'Avery');
  await click(element<HTMLInputElement>('.toggle-row input'));
  assert.equal((await stored()).preferences.name, 'Avery');
  assert.equal(document.documentElement.classList.contains('large-text'), true);
  await click(button('Clear my local data'));
  assert.notDeepEqual(await stored(), emptyData(), 'Opening reset confirmation must preserve data');
  await click(button('Clear local data', element('dialog')));
  assert.deepEqual(await stored(), emptyData());
  assert.equal(document.documentElement.classList.contains('large-text'), false);
  await reload();
  assert.deepEqual(await stored(), emptyData());
  assert.match(container.textContent ?? '', /Where will your next story begin/);
});
