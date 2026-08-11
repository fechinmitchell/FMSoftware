// ------------------------------------------------------------------
//  /api/contact — Vercel serverless function
//  Lives in the FRONTEND repo at api/contact.js (folder beside src/).
//  Vercel picks it up automatically; no Express server needed.
//
//  Setup (once):
//   1. Sign up free at https://resend.com with your email
//   2. Create an API key
//   3. In Vercel → your project → Settings → Environment Variables, add:
//        RESEND_API_KEY = re_xxxxxxxx
//        CONTACT_TO     = fechinmitchell1996@gmail.com   (optional, this is the default)
//   4. Redeploy. Done — form submissions land in your inbox.
//
//  Until you verify the fmsoftware.ie domain in Resend, the "from"
//  must stay onboarding@resend.dev and Resend will only deliver to
//  the email you signed up with — sign up with the address above.
//  After verifying the domain, set CONTACT_FROM to e.g.
//  "FM Software <letswork@fmsoftware.ie>".
// ------------------------------------------------------------------

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const { name, email, message, company } = req.body || {};

  // honeypot: the visible form never sends "company" — bots often fill it
  if (company) return res.json({ success: true });

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Please fill in all three fields.' });
  }
  if (
    typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string' ||
    name.length > 200 || email.length > 320 || message.length > 5000 || !EMAIL_RE.test(email)
  ) {
    return res.status(400).json({ success: false, message: 'Something looks off — check the fields and try again.' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('contact: RESEND_API_KEY is not set');
    return res.status(500).json({ success: false, message: 'Message service not configured yet. Email me directly instead.' });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || 'FM Software site <onboarding@resend.dev>',
        to: [process.env.CONTACT_TO || 'fechinmitchell1996@gmail.com'],
        reply_to: email, // hitting Reply answers the enquirer directly
        subject: `New enquiry from ${name} — fmsoftware.ie`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      }),
    });

    if (!r.ok) {
      console.error('contact: resend error', r.status, (await r.text()).slice(0, 300));
      return res.status(502).json({ success: false, message: 'Could not send just now. Email me directly instead.' });
    }

    return res.json({ success: true, message: 'Thanks! Your message has been received.' });
  } catch (err) {
    console.error('contact: ', err);
    return res.status(500).json({ success: false, message: 'Could not send just now. Email me directly instead.' });
  }
}
