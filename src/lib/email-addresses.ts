const addressPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function validEmailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && addressPattern.test(value);
}

export function parseEmailAddresses(value: string | string[], maximum = 20): string[] {
  const entries = typeof value === "string" ? value.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean) : value;
  if (!Array.isArray(entries) || entries.length > maximum || entries.some(address => typeof address !== "string" || !validEmailAddress(address.trim()))) {
    throw new Error(`Enter up to ${maximum} valid email addresses, separated by commas or new lines.`);
  }
  return [...new Set(entries.map(address => address.trim().toLowerCase()))];
}

export function emailRecipients(to: string[], cc: string[] = [], bcc: string[] = []) {
  const recipients = new Set<string>();
  const unique = (list: string[]) => parseEmailAddresses(list).filter(address => {
    if (recipients.has(address)) return false;
    recipients.add(address);
    return true;
  });
  const result = { to: unique(to), cc: unique(cc), bcc: unique(bcc) };
  if (!result.to.length || recipients.size > 20) throw new Error("Enter a To address and up to 20 recipients in total.");
  return result;
}
