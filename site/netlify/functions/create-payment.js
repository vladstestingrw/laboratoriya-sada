const YUKASSA_SHOP_ID = process.env.YUKASSA_SHOP_ID || 'DUMMY_SHOP_ID';
const YUKASSA_SECRET_KEY = process.env.YUKASSA_SECRET_KEY || 'DUMMY_SECRET_KEY';
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '6Leg8nQtAAAAAKg12MaLbdNl2QeXFa4Y8rR95qCI';
const SITE_URL = process.env.URL || 'https://laboratoriyasada.ru';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  const { productCode, productName, price, email, name, phone, telegram, recaptchaToken } = JSON.parse(event.body);

  // Verify reCAPTCHA v2
  if (!recaptchaToken) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Пожалуйста, подтвердите что вы не робот' }) };
  }

  const verifyRes = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${recaptchaToken}`,
    { method: 'POST' }
  );
  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Проверка безопасности не пройдена. Попробуйте ещё раз.' }) };
  }

  // DUMMY MODE
  if (YUKASSA_SHOP_ID === 'DUMMY_SHOP_ID') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        confirmationUrl: `${SITE_URL}/payment-success.html?product=${productCode}&test=true`,
        dummy: true
      })
    };
  }

  // LIVE MODE
  const idempotenceKey = `${email}-${productCode}-${Date.now()}`;
  const paymentData = {
    amount: { value: price.toFixed(2), currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: `${SITE_URL}/payment-success.html?product=${productCode}` },
    capture: true,
    description: productName,
    receipt: {
      customer: { email, phone },
      items: [{
        description: productName,
        quantity: '1.00',
        amount: { value: price.toFixed(2), currency: 'RUB' },
        vat_code: 1,
        payment_mode: 'full_payment',
        payment_subject: 'service'
      }]
    },
    metadata: { productCode, email, name, phone, telegram }
  };

  const credentials = Buffer.from(`${YUKASSA_SHOP_ID}:${YUKASSA_SECRET_KEY}`).toString('base64');
  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Idempotence-Key': idempotenceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(paymentData)
  });

  const payment = await response.json();
  if (!response.ok) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: payment.description || 'Ошибка создания платежа' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, confirmationUrl: payment.confirmation.confirmation_url })
  };
};
