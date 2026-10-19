/** Salary timeline dates use half-open ranges: valid_from is inclusive and valid_until is exclusive. */
export function salaryRowOverlapsPayrollPeriod(
  validFrom: string,
  validUntil: string | null,
  periodStart: string,
  periodEndInclusive: string,
): boolean {
  return validFrom <= periodEndInclusive
    && (validUntil === null || validUntil > periodStart)
}

export function salaryRowCoversPayrollPeriod(
  validFrom: string,
  validUntil: string | null,
  periodStart: string,
  periodEndInclusive: string,
): boolean {
  return validFrom <= periodStart
    && (validUntil === null || validUntil > periodEndInclusive)
}
