/**
 * @module ui/LogScreen
 * Expedition Log tab: current objective, completed missions, unlocked log entries (newest first).
 */
import { LOG_ENTRIES, MISSIONS } from '../story.js';
import { currentMission } from '../systems/Story.js';

const entry = (id) => LOG_ENTRIES.find((e) => e.id === id);
export const hasUnread = (ec) => ec.story.seen.some((id) => !ec.story.read.includes(id) && !entry(id)?.modal);
/** Opening the tab reads every non-modal entry. */
export function markLogRead(ec) { for (const id of ec.story.seen) if (!ec.story.read.includes(id) && !entry(id)?.modal) ec.story.read.push(id); }

/** @param {any} ec */
export function renderLog(ec) {
  const cur = currentMission(ec);
  const done = MISSIONS.slice(0, ec.story.mission).map((m) => `<li>✓ ${m.text}</li>`).join('');
  const arts = [...ec.story.seen].reverse().map(entry).filter(Boolean).map((e) =>
    `<article data-id="${e.id}" class="${ec.story.read.includes(e.id) ? '' : 'unread'}"><div class="up-stats">Chapter ${e.chapter}</div><div class="up-name">${e.title}</div>${e.text.split(/\n\s*\n/).map((p) => `<p>${p}</p>`).join('')}</article>`).join('');
  return `<div class="log-obj"><div class="up-stats">Objective</div><div class="up-name">${cur ? cur.text : 'All objectives complete'}</div></div>
    ${done ? `<ul class="log-done up-stats">${done}</ul>` : ''}${arts}`;
}
