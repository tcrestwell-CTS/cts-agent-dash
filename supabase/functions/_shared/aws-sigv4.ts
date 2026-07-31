// Minimal AWS Signature V4 signer for JSON (query-less) service calls.
// Used server-side only — credentials come from edge function secrets.

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(data)));
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export async function signAwsJsonRequest(opts: {
  service: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  target: string;
  body: string;
  contentType?: string;
}): Promise<SignedRequest> {
  const { service, region, accessKeyId, secretAccessKey, sessionToken, target, body } = opts;
  const contentType = opts.contentType ?? "application/x-amz-json-1.1";
  const host = `${service}.${region}.amazonaws.com`;
  const url = `https://${host}/`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);

  const headers: Record<string, string> = {
    "content-type": contentType,
    host,
    "x-amz-date": amzDate,
    "x-amz-target": target,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmac(enc.encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));

  return {
    url,
    body,
    headers: {
      ...headers,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}