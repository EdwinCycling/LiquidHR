// @vitest-environment happy-dom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import type { FormProjection } from "@/lib/process-automation/form-runtime"
import { FormRuntimeRenderer, type FormRuntimeLabels, type FormRuntimeServerFieldError } from "./form-runtime-renderer"

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true })

const labels: FormRuntimeLabels = {
  currentValue: "Huidige waarde",
  newValue: "Nieuwe waarde",
  saving: "Opslaan",
  saved: "Opgeslagen",
  saveError: "Opslaan mislukt",
  stale: "Verouderd",
  save: "Bewaren",
  errorSummary: "Controleer het veld",
  required: "Vul dit veld in.",
  invalid: "Vul een geldige waarde in.",
  readOnly: "Alleen lezen",
  noValue: "Geen waarde",
  booleanTrue: "Ja",
  booleanFalse: "Nee",
  referenceSearch: "Zoeken",
  referenceLoading: "Laden",
  referenceNoOptions: "Geen resultaten",
  scrollHint: "Meer velden",
}

const projection: FormProjection = {
  responseId: null,
  workItemId: "11111111-1111-4111-8111-111111111111",
  processInstanceId: "22222222-2222-4222-8222-222222222222",
  stepInstanceId: "33333333-3333-4333-8333-333333333333",
  stepKey: "request",
  participantKey: "employee",
  formKey: "training",
  formVersionId: null,
  language: "nl",
  status: "IN_PROGRESS",
  revision: 0,
  expectedVersion: 0,
  title: "Opleidingsaanvraag",
  description: null,
  sections: [{
    key: "training",
    title: "Opleiding",
    fields: [{
      key: "expected_cost",
      label: "Verwachte kosten",
      helpText: null,
      type: "MONEY",
      accessMode: "WRITE_REQUIRED",
      required: true,
      options: [],
      currentValue: null,
      newValue: null,
    }],
  }],
  summary: [],
  htmlSummary: "",
  availableLanguages: ["nl"],
}

interface MountedRenderer {
  readonly container: HTMLDivElement
  readonly unmount: () => void
}

function mountRenderer(serverFieldError?: FormRuntimeServerFieldError): MountedRenderer {
  const container = document.createElement("div")
  document.body.append(container)
  const root: Root = createRoot(container)
  act(() => root.render(createElement(FormRuntimeRenderer, {
    initialProjection: projection,
    locale: "nl",
    labels,
    embedded: true,
    serverFieldError,
  })))
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

let mounted: MountedRenderer | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe("FormRuntimeRenderer server validation feedback", () => {
  it("leaves empty required draft fields editable and shows submit errors beside the matching field", () => {
    mounted = mountRenderer({ fieldKey: "expected_cost", code: "REQUIRED_FORM_FIELD", sequence: 1 })

    expect(mounted.container.querySelector("#form-error-expected_cost")?.textContent).toBe(labels.required)
    expect(mounted.container.querySelector("#form-field-expected_cost")?.getAttribute("aria-invalid")).toBe("true")
    expect(mounted.container.querySelector('[role="alert"]')?.textContent).toContain(labels.required)
  })

  it("does not render a server field error for a field absent from the authorized projection", () => {
    mounted = mountRenderer({ fieldKey: "hidden_internal_field", code: "INVALID_FORM_VALUE", sequence: 1 })

    expect(mounted.container.querySelector('[role="alert"]')).toBeNull()
    expect(mounted.container.textContent).not.toContain("hidden_internal_field")
  })
})
