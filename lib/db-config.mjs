import { readFileSync } from "node:fs";

/**
 * Which database the app and migration use, in order of preference:
 * Tiger Data (TIGER_DATABASE_URL), then Supabase, else none (the app runs on the JSON seeds).
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ provider: "Tiger Data" | "Supabase", config: import("pg").PoolConfig } | null}
 */
export function dbConfig(env = process.env) {
  const tiger = tigerDbConfig(env);
  if (tiger) return { provider: "Tiger Data", config: tiger };
  const supabase = supabaseDbConfig(env);
  if (supabase) return { provider: "Supabase", config: supabase };
  return null;
}

/**
 * Tiger Data (Timescale Cloud) Postgres: TIGER_DATABASE_URL is the service's connection
 * string (Tiger console → service → Connect, or `tiger db uri`).
 *
 * TLS is always verified. Tiger services present a publicly trusted certificate (Google
 * Trust Services), so Node's built-in CA store is enough; set TIGER_DATABASE_CA (a PEM file
 * path) to pin a CA instead. The URL's sslmode is dropped: `sslmode=require` would encrypt
 * without checking the certificate.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {import("pg").PoolConfig | null} null when Tiger Data isn't configured
 */
export function tigerDbConfig(env = process.env) {
  if (!env.TIGER_DATABASE_URL) return null;
  const url = new URL(env.TIGER_DATABASE_URL);
  url.searchParams.delete("sslmode");
  const ssl = env.TIGER_DATABASE_CA
    ? { rejectUnauthorized: true, ca: readFileSync(env.TIGER_DATABASE_CA, "utf8") }
    : { rejectUnauthorized: true };
  return { connectionString: url.toString(), ssl };
}

/**
 * Supabase Postgres connection settings, shared by the app (lib/db.ts) and the
 * migration script (scripts/db/migrate.mjs).
 *
 * Either SUPABASE_DATABASE_URL (a full connection string), or the project's
 * SUPABASE_URL + SUPABASE_DATABASE_PASSWORD + SUPABASE_POOLER_HOST, which
 * connect through the IPv4 session pooler as `postgres.<project-ref>`. (The direct
 * db.<ref>.supabase.co host is IPv6-only.)
 *
 * TLS is always verified, against Supabase's root CA below (published by Supabase: the
 * "Download certificate" link in Database settings, SHA-256 80:70:25:AD…:CA:FA). Override
 * with SUPABASE_DATABASE_CA (a PEM file path).
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {import("pg").PoolConfig | null} null when Supabase isn't configured
 */
export function supabaseDbConfig(env = process.env) {
  const ca = env.SUPABASE_DATABASE_CA ? readFileSync(env.SUPABASE_DATABASE_CA, "utf8") : SUPABASE_ROOT_CA;
  const ssl = { rejectUnauthorized: true, ca };

  if (env.SUPABASE_DATABASE_URL) {
    const url = new URL(env.SUPABASE_DATABASE_URL);
    // sslmode in the URL would replace the verified ssl options above.
    url.searchParams.delete("sslmode");
    return { connectionString: url.toString(), ssl };
  }
  const { SUPABASE_URL: project, SUPABASE_DATABASE_PASSWORD: password } = env;
  const host = env.SUPABASE_POOLER_HOST;
  if (!project || !password || !host) return null;
  const ref = new URL(project).hostname.split(".")[0];
  return { host, port: 5432, user: `postgres.${ref}`, password, database: "postgres", ssl };
}

/**
 * Which variables are missing, for error messages.
 * @param {Record<string, string | undefined>} [env]
 */
export function missingDbEnv(env = process.env) {
  if (env.TIGER_DATABASE_URL || env.SUPABASE_DATABASE_URL) return [];
  return ["SUPABASE_URL", "SUPABASE_DATABASE_PASSWORD", "SUPABASE_POOLER_HOST"].filter((k) => !env[k]);
}

/** Supabase Root 2021 CA (valid until 2031-04-26). Public certificate, not a secret. */
const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;
