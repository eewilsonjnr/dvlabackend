export function generateRef(type: 'IDP' | 'ICMV'): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `GH-${type}-${year}-${rand}`;
}

// ICAO 9303 check digit — Luhn-style weighted sum over the MRZ character set
function mrzCheckDigit(s: string): string {
  const weights = [7, 3, 1];
  const vals: Record<string, number> = { '<': 0 };
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => { vals[c] = i + 10; });
  '0123456789'.split('').forEach(c => { vals[c] = parseInt(c); });
  const sum = s.split('').reduce((acc, c, i) => acc + (vals[c] ?? 0) * weights[i % 3], 0);
  return String(sum % 10);
}

export function generateMRZ(
  surname: string, otherNames: string,
  dateOfBirth: string, dateOfExpiry: string, licenceNumber: string
) {
  const pad = (s: string, n: number) =>
    s.toUpperCase().replace(/[^A-Z0-9]/g, '<').padEnd(n, '<').slice(0, n);

  // Line 1: P<GHA + surname<<othernames (44 chars total, no check digit on line 1)
  const namePart = `${pad(surname, 39)}`.replace(/</g, '<');
  const line1 = `P<GHA${namePart}`.padEnd(44, '<').slice(0, 44);

  // Line 2: document number (9) + check + nationality (3) + DOB (6) + check + sex (1) + expiry (6) + check + personal number (14) + check + composite check
  const docNum  = pad(licenceNumber, 9);
  const dob     = dateOfBirth.replace(/-/g, '').slice(2, 8).padEnd(6, '0');
  const exp     = dateOfExpiry.replace(/-/g, '').slice(2, 8).padEnd(6, '0');
  const personal = '<<<<<<<<<<<<<<'; // 14 chars

  const docCheck  = mrzCheckDigit(docNum);
  const dobCheck  = mrzCheckDigit(dob);
  const expCheck  = mrzCheckDigit(exp);
  const perCheck  = mrzCheckDigit(personal);

  // Composite check digit covers: docNum+docCheck + personal+perCheck + dob+dobCheck + sex + exp+expCheck
  const compositeField = `${docNum}${docCheck}${personal}${perCheck}${dob}${dobCheck}M${exp}${expCheck}`;
  const compositeCheck = mrzCheckDigit(compositeField);

  const line2 = `${docNum}${docCheck}GHA${dob}${dobCheck}M${exp}${expCheck}${personal}${compositeCheck}`;
  return { line1, line2: line2.slice(0, 44) };
}

export function generateContractNumber(prefix = 'DVLA'): string {
  const ts = Date.now().toString().slice(-8);
  return `${prefix}-${ts}`;
}
