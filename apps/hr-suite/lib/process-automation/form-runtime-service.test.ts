import { describe, expect, it } from "vitest"
import {
  formRuntimeErrorResponse,
  formRuntimeFieldKeyFromRpcDetails,
  FormRuntimeError,
} from "./form-runtime-service"

describe("form runtime validation error contract", () => {
  it("retains a field key only for required and invalid field failures", () => {
    expect(formRuntimeFieldKeyFromRpcDetails("REQUIRED_FORM_FIELD", "high_cost_reason")).toBe("high_cost_reason")
    expect(formRuntimeFieldKeyFromRpcDetails("INVALID_FORM_VALUE", "expected_cost")).toBe("expected_cost")
    expect(formRuntimeFieldKeyFromRpcDetails("FORBIDDEN", "private detail")).toBeNull()
    expect(formRuntimeFieldKeyFromRpcDetails("REQUIRED_FORM_FIELD", "unsafe\nkey")).toBeNull()
  })

  it("returns the validated field key for accessible inline error rendering", async () => {
    const response = formRuntimeErrorResponse(new FormRuntimeError("REQUIRED_FORM_FIELD", 400, "REQUIRED_FORM_FIELD", "high_cost_reason"))
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({ code: "REQUIRED_FORM_FIELD", fieldKey: "high_cost_reason" })
  })
})
