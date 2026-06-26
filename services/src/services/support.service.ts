/**
 * Support service — lets a client open a SAV ticket from inside the app.
 * Tickets land in support_tickets and surface in the Espace Gérante SAV queue.
 */
import { supabase } from './supabase.service.js';

export interface NewTicket {
  userId?: string | null;
  email?: string | null;
  subject?: string;
  message: string;
  priority?: 'normal' | 'vip';
}

export const supportService = {
  async create(t: NewTicket): Promise<{ id: string }> {
    const [row] = await supabase.upsert<{ id: string }>('support_tickets', {
      user_id: t.userId ?? null,
      email: t.email ?? null,
      subject: (t.subject || 'Demande').slice(0, 160),
      message: t.message.slice(0, 4000),
      status: 'open',
      priority: t.priority || 'normal',
    });
    return { id: row?.id };
  },
};
