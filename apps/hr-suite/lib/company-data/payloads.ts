import type { CompanyData } from './service'

export type CompanyDataUpdatePayload = Omit<CompanyData, 'id'>

export function toCompanyDataUpdatePayload(company: CompanyData): CompanyDataUpdatePayload {
  return {
    singleLocation: company.singleLocation,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    street: company.street,
    houseNumber: company.houseNumber,
    houseNumberAddition: company.houseNumberAddition,
    postalCode: company.postalCode,
    city: company.city,
    region: company.region,
    countryCode: company.countryCode,
  }
}
