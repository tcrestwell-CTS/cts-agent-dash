/**
 * Minimal plain-old-XML helpers for MSC API 3.0.
 *
 * MSC 3.0 is stateless POX over HTTPS: no SOAP envelope, no WSDL, no session.
 * Auth is three headers on every call: UserId, AgencyId, Password.
 */

export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type XmlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | XmlNode
  | XmlValue[];

export interface XmlNode {
  [tag: string]: XmlValue;
}

/** Build XML children preserving key order (xs:sequence order is enforced). */
export function buildXmlBody(node: XmlNode): string {
  let out = "";
  for (const [tag, value] of Object.entries(node)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === null || item === undefined) continue;
        out += typeof item === "object"
          ? `<${tag}>${buildXmlBody(item as XmlNode)}</${tag}>`
          : `<${tag}>${escapeXml(item)}</${tag}>`;
      }
    } else if (typeof value === "object") {
      out += `<${tag}>${buildXmlBody(value as XmlNode)}</${tag}>`;
    } else {
      out += `<${tag}>${escapeXml(value)}</${tag}>`;
    }
  }
  return out;
}

export function buildXmlRequest(root: string, body: XmlNode): string {
  return `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="DTS">${buildXmlBody(body)}</${root}>`;
}

/** Very small tag reader — enough for AdvisoryInfo and scalar extraction. */
export function readTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

export function readTag(xml: string, tag: string): string | null {
  const [first] = readTags(xml, tag);
  return first === undefined ? null : first.trim();
}

export interface AdvisoryMessage {
  /** F = failure, S = success, W = warning */
  type: string;
  code: string | null;
  text: string | null;
}

/**
 * MSC returns HTTP 200 even on failure. Never treat 200 as success — parse
 * AdvisoryInfo first; MessageType=F is a failure regardless of status code.
 */
export function parseAdvisory(xml: string): {
  messages: AdvisoryMessage[];
  failed: boolean;
} {
  const messages = readTags(xml, "AdvisoryMessage").map((block) => ({
    type: (readTag(block, "MessageType") ?? "").toUpperCase(),
    code: readTag(block, "MessageCode"),
    text: readTag(block, "MessageText"),
  }));
  return { messages, failed: messages.some((m) => m.type === "F") };
}