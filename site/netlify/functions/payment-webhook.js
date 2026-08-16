const YUKASSA_SECRET_KEY = process.env.YUKASSA_SECRET_KEY || 'DUMMY_SECRET_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'DUMMY_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'DUMMY_SUPABASE_SERVICE_KEY';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const notification = JSON.parse(event.body);

  // Only process succeeded payments
  if (notification.event !== 'payment.succeeded') {
    return { statusCode: 200, body: 'OK' };
  }

  const payment = notification.object;
  const { productCode, email, name } = payment.metadata;

  // DUMMY MODE — just log
  if (SUPABASE_URL === 'DUMMY_SUPABASE_URL') {
    console.log('DUMMY: Would grant access', { email, productCode });
    return { statusCode: 200, body: 'OK (dummy mode)' };
  }

  // Calculate expiry (6 months for lectures, no expiry for practice)
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 6);

  // Find or create user in Supabase, then insert purchase
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  // Insert purchase record
  await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_email: email,
      mk_code: productCode,
      expires_at: expiresAt.toISOString(),
      payment_id: payment.id,
      amount: parseFloat(payment.amount.value)
    })
  });

  return { statusCode: 200, body: 'OK' };
};
