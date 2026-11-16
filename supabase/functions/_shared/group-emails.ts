// Each saved event produces one expected client copy and one owner notification.
export type GroupEmail = { audience: 'client' | 'advisor'; to: string; subject: string; html: string };

export async function deliverGroupEmail(
  message: GroupEmail,
  apiKey: string | undefined,
  from: string,
  replyTo: string,
  idempotencyKey: string,
  transport: typeof fetch = fetch,
) {
  if (!apiKey) return { status: 'failed', error: 'Email sending is not configured', id: null };
  try {
    const response = await transport('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from, reply_to: replyTo, to: [message.to], subject: message.subject, html: message.html }),
    });
    const result = await response.json();
    if (!response.ok || !result.id) return { status: 'failed', error: result.message || `Email provider error (${response.status})`, id: null };
    return { status: 'sent', error: null, id: String(result.id) };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'Email send failed', id: null };
  }
}

export async function sendGroupEventEmails(opts: {
  admin: any; brand: { from: string; replyTo: string }; userId: string; apiKey?: string;
  eventId: string; template: string; clientId?: string | null;
  clientEmail: string; clientSubject: string; clientHtml: string;
  advisorSubject: string; advisorHtml: string; metadata: Record<string, unknown>;
}) {
  const apiKey = opts.apiKey;
  const sendOne = async (message: GroupEmail) => {
    const key = `${opts.template}-${opts.eventId}-${message.audience}`;
    const { data: prior } = await opts.admin.from('email_logs').select('id').eq('idempotency_key', key).eq('status', 'sent').maybeSingle();
    if (prior) return;
    const result = await deliverGroupEmail(message, apiKey, opts.brand.from, opts.brand.replyTo, key);
    const { error } = await opts.admin.from('email_logs').insert({
      user_id: opts.userId, client_id: message.audience === 'client' ? opts.clientId ?? null : null,
      to_email: message.to, subject: message.subject, template: `${opts.template}_${message.audience}`,
      status: result.status, error_message: result.error, provider_message_id: result.id,
      sent_at: new Date().toISOString(),
      idempotency_key: key, attempt_count: 1, metadata: { ...opts.metadata, audience: message.audience },
    });
    if (error) console.error('Group email logging failed:', error.message);
    if (result.error) console.error('Group email failed:', message.audience, result.error);
  };
  // Resolve the actual trip owner's account; never use a traveler-supplied recipient.
  const { data, error } = await opts.admin.auth.admin.getUserById(opts.userId);
  const advisorEmail = data?.user?.email;
  await sendOne({ audience: 'client', to: opts.clientEmail, subject: opts.clientSubject, html: opts.clientHtml });
  if (advisorEmail) {
    await sendOne({ audience: 'advisor', to: advisorEmail, subject: opts.advisorSubject, html: opts.advisorHtml });
  } else {
    console.error('Group advisor email unavailable:', error?.message || 'Owner has no email address');
  }
}