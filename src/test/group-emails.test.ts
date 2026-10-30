import { describe, expect, it, vi } from 'vitest';
import { deliverGroupEmail } from '../../supabase/functions/_shared/group-emails';

describe('group event email delivery', () => {
  it.each(['client', 'advisor'] as const)('sends the %s copy as an individual event email', async (audience) => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }));
    const to = `${audience}@example.com`;
    const result = await deliverGroupEmail({ audience, to, subject: 'Saved selections', html: '<p>Saved</p>' }, 'test-key', 'Agency <send@example.com>', 'advisor@example.com', `proposal-123-${audience}`, transport);
    expect(result).toEqual({ status: 'sent', error: null, id: 'email-123' });
    expect(JSON.parse(transport.mock.calls[0][1].body).to).toEqual([to]);
    expect(transport.mock.calls[0][1].headers['Idempotency-Key']).toBe(`proposal-123-${audience}`);
  });
  it('records missing configuration as failure rather than silently skipping', async () => {
    const transport = vi.fn();
    const result = await deliverGroupEmail({ audience: 'client', to: 'client@example.com', subject: 'Saved', html: '' }, undefined, 'sender', 'reply', 'event-1', transport);
    expect(result.status).toBe('failed');
    expect(transport).not.toHaveBeenCalled();
  });
  it('does not claim success when the provider rejects the email', async () => {
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Sender not verified' }), { status: 403 }));
    expect(await deliverGroupEmail({ audience: 'client', to: 'client@example.com', subject: 'Saved', html: '' }, 'test-key', 'sender', 'reply', 'event-1', transport)).toEqual({ status: 'failed', error: 'Sender not verified', id: null });
  });
});