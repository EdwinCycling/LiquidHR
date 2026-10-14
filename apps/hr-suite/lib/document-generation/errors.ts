export class DocumentGenerationError extends Error {
  constructor(readonly code: string, readonly status: number, readonly details?: readonly string[]) {
    super(code)
    this.name = 'DocumentGenerationError'
  }
}

export class DocumentSigningError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code)
    this.name = 'DocumentSigningError'
  }
}
