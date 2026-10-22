export interface StoredCredentials {
  percyToken?: string;
  username?: string;
  accessKey?: string;
}

const KEY = "percy_report_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function readCredentials(): StoredCredentials {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${KEY}=`));
  if (!match) return {};
  try {
    return JSON.parse(decodeURIComponent(match.slice(KEY.length + 1))) as StoredCredentials;
  } catch {
    return {};
  }
}

export function writeCredentials(creds: StoredCredentials) {
  const value = encodeURIComponent(JSON.stringify(creds));
  document.cookie = `${KEY}=${value}; Max-Age=${MAX_AGE}; Path=/; SameSite=Strict`;
}

export function clearCredentials() {
  document.cookie = `${KEY}=; Max-Age=0; Path=/; SameSite=Strict`;
}
