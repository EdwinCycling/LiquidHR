import { dispatchWorkforceTool, listWorkforceToolDescriptors, type WorkforceToolDescriptor } from './registry'

export interface LocalWorkforceMcpCall {
  name: string
  arguments: unknown
}

export interface LocalWorkforceMcpHarness {
  listTools(): WorkforceToolDescriptor[]
  callTool(call: LocalWorkforceMcpCall): Promise<unknown>
}

/** In-process harness for contract tests. It does not open a network listener. */
export function createLocalWorkforceMcpHarness(): LocalWorkforceMcpHarness {
  return {
    listTools: listWorkforceToolDescriptors,
    callTool: (call) => dispatchWorkforceTool(call.name, call.arguments),
  }
}
