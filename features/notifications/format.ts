/** Pure render helper: a notification row → its localized one-line message. */

import type { TFunction } from 'i18next';

import type { NotificationRow } from '@/lib/database.types';

export function formatNotification(t: TFunction, row: NotificationRow): string {
  // Per-type template (natural word order per language); falls back to the actor
  // name alone if a future type has no key yet.
  return t(`notifications.msg.${row.type}`, {
    actor: row.actor_name,
    subject: row.subject,
    defaultValue: row.actor_name,
  });
}
