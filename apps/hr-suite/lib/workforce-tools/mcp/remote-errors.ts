export type RemoteMcpToolErrorCode =
  | 'MCP_RATE_LIMITED'
  | 'MCP_AUTHORIZATION_DENIED'
  | 'MCP_SERVICE_UNAVAILABLE'

export class RemoteMcpToolError extends Error {
  constructor(readonly code: RemoteMcpToolErrorCode) {
    super(code)
    this.name = 'RemoteMcpToolError'
  }
}
