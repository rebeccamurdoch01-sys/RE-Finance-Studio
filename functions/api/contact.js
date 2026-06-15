// Cloudflare Pages Function — handles POST /api/contact
// Receives the contact form submission and sends it to you via Resend.
//
// Required environment variables (set these in the Cloudflare dashboard,
// Settings → Environment variables, or as a secret):
//   RESEND_API_KEY  — your Resend API key (store as a Secret)
//   TO_EMAIL        — the inbox where you want enquiries delivered
//   FROM_EMAIL      — a verified Resend sender, e.g. hello@your-domain.com

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();

    const firstName = (data.firstName || '').toString().trim();
    const lastName = (data.lastName || '').toString().trim();
    const email = (data.email || '').toString().trim();
    const businessType = (data.businessType || '').toString().trim();
    const message = (data.message || '').toString().trim();

    // --- Validation ---
    if (!firstName || !lastName || !email || !businessType) {
      return json({ error: 'Please fill in all required fields.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }
    if (message.length > 5000) {
      return json({ error: 'Message is too long.' }, 400);
    }

    // --- Compose the email ---
    const subject = `New enquiry from ${firstName} ${lastName} — RE Finance Studio`;
    const textBody =
      `New enquiry via RE Finance Studio website\n\n` +
      `Name: ${firstName} ${lastName}\n` +
      `Email: ${email}\n` +
      `Business type: ${businessType}\n\n` +
      `Message:\n${message || '(none provided)'}\n`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #3a2e2b; line-height: 1.6;">
        <h2 style="color: #883F39;">New enquiry via RE Finance Studio</h2>
        <p><strong>Name:</strong> ${escapeHtml(firstName)} ${escapeHtml(lastName)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        <p><strong>Business type:</strong> ${escapeHtml(businessType)}</p>
        <p><strong>Message:</strong><br>${escapeHtml(message || '(none provided)').replace(/\n/g, '<br>')}</p>
      </div>`;

    // --- Send via Resend ---
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `RE Finance Studio <${env.FROM_EMAIL}>`,
        to: [env.TO_EMAIL],
        reply_to: email,
        subject,
        text: textBody,
        html: htmlBody
      })
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error('Resend error:', detail);
      return json({ error: 'Could not send message. Please try again later.' }, 502);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('Function error:', err);
    return json({ error: 'Unexpected error. Please try again.' }, 500);
  }
}

// Reject non-POST methods cleanly
export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  return onRequestPost(context);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
