const TEST_MODE_KEYS = ['contactTestMode', 'contactTestToken', 'testMode', 'testModeToken'];

function isEnabledValue(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function parseHashParams(hash) {
  const value = String(hash || '').replace(/^#/, '');
  return value ? new URLSearchParams(value) : new URLSearchParams();
}

export function getContactTestModeFromUrl(href, baseHref = 'https://support.speed-ad.com/contact/') {
  const url = new URL(href, baseHref);
  const hashHadTestKeys = TEST_MODE_KEYS.some((key) => url.hash.includes(`${key}=`));
  const hashParams = parseHashParams(url.hash);
  const modeValue = hashParams.get('contactTestMode') || url.searchParams.get('contactTestMode') || '';
  const token = hashParams.get('contactTestToken') || url.searchParams.get('contactTestToken') || '';
  const enabled = isEnabledValue(modeValue);

  TEST_MODE_KEYS.forEach((key) => {
    url.searchParams.delete(key);
    hashParams.delete(key);
  });

  if (hashHadTestKeys) {
    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : '';
  }

  return {
    enabled,
    token: enabled ? token : '',
    cleanedUrl: url.href,
  };
}
