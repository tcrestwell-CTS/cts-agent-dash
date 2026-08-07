/**
 * Parser for DtsAgencyLoginMessageResponse (mscbee/services/agency/agencylogin).
 *
 * Agency Login validates AgencyID / AgentID / Agentpasswd and returns the
 * agency profile plus the SecurityOverrides that decide what the agency is
 * allowed to do (book, cancel, pay by CC, manage groups...).
 */
import { readTag, readTags } from "./msc-xml.ts";

export interface MscSecurityOverrides {
  cannotMakeBookings: boolean;
  cannotCancelBookings: boolean;
  cannotReviseItems: boolean;
  cannotCancelItems: boolean;
  cannotViewChanges: boolean;
  cannotPrintDocuments: boolean;
  subAgent: boolean;
  canPayByCC: boolean;
  canPayByCheck: boolean;
  cannotManageGroup: boolean;
  ccPaymentMandatoryToConfirm: boolean;
  canPayByNPS: boolean;
  cannotConfirmGroupBooking: boolean;
  ccPaymentMandatoryToConfirmGroupBooking: boolean;
  guaranteeClearanceForGroup: boolean;
  moveFITToGroup: boolean;
  cannotConfirmBooking: boolean;
  disableBookingView: boolean;
  allowInvoiceNotification: boolean;
  allowEticketNotification: boolean;
}

export interface MscContractDetail {
  accepted: boolean;
  version: string | null;
  contractDate: string | null;
  expiryDays: string | null;
  channel: string | null;
  valid: boolean;
}

export interface MscAgencyLogin {
  /** True only when the gateway returned an agency profile and no failure. */
  authenticated: boolean;
  message: string | null;
  result: string | null;
  agencyCode: string | null;
  agentId: string | null;
  agentName: string | null;
  agentType: string | null;
  agentLocation: string | null;
  administrator: boolean;
  contactName: string | null;
  /** Defaults used for every other MSC call. */
  officeCode: string | null;
  marketCode: string | null;
  currencyCode: string | null;
  language: string | null;
  consortiumCode: string | null;
  consortiumDescription: string | null;
  iataNo: string | null;
  payMethod: string | null;
  paymentTerm: string | null;
  viewInvoice: boolean;
  address: {
    addressId: string | null;
    addressOne: string | null;
    city: string | null;
    stateCode: string | null;
    districtCode: string | null;
    countryCode: string | null;
    zipPostalCode: string | null;
    telephoneNo: string | null;
    faxNo: string | null;
    emailAddress: string | null;
    url: string | null;
  };
  representative: {
    firstName: string | null;
    surname: string | null;
    email: string | null;
    salesPerson: string | null;
    managerName: string | null;
    rmgrCd: string | null;
  };
  securityOverrides: MscSecurityOverrides | null;
  contractDetail: MscContractDetail | null;
}

/** MSC uses Yes/No, YES/NO and true/false interchangeably. */
function bool(value: string | null): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "yes" || v === "y" || v === "true";
}

function parseSecurityOverrides(xml: string): MscSecurityOverrides | null {
  const [block] = readTags(xml, "SecurityOverrides");
  if (block === undefined) return null;
  const b = (tag: string) => bool(readTag(block, tag));
  return {
    cannotMakeBookings: b("CannotMakeBookings"),
    cannotCancelBookings: b("CannotCancelBookings"),
    cannotReviseItems: b("CannotReviseItems"),
    cannotCancelItems: b("CannotCancelItems"),
    cannotViewChanges: b("CannotViewChanges"),
    cannotPrintDocuments: b("CannotPrintDocuments"),
    subAgent: b("SubAgent"),
    canPayByCC: b("CanPayByCC"),
    canPayByCheck: b("CanPayByCheck"),
    cannotManageGroup: b("CannotManageGroup"),
    ccPaymentMandatoryToConfirm: b("CCPaymentMandatoryToConfirm"),
    canPayByNPS: b("CanPayByNPS"),
    cannotConfirmGroupBooking: b("CannotConfirmGroupBooking"),
    ccPaymentMandatoryToConfirmGroupBooking: b("CCPaymentMandatoryToConfirmGroupBooking"),
    guaranteeClearanceForGroup: b("GuaranteeClearanceForGroup"),
    moveFITToGroup: b("MoveFITToGroup"),
    cannotConfirmBooking: b("CannotConfirmBooking"),
    disableBookingView: b("DisableBookingView"),
    allowInvoiceNotification: b("AllowInvoiceNotification"),
    allowEticketNotification: b("AllowEticketNotification"),
  };
}

function parseContractDetail(xml: string): MscContractDetail | null {
  const [block] = readTags(xml, "ContractDetail");
  if (block === undefined) return null;
  return {
    accepted: bool(readTag(block, "Accepted")),
    version: readTag(block, "Version"),
    contractDate: readTag(block, "ContractDate"),
    expiryDays: readTag(block, "ExpiryDays"),
    channel: readTag(block, "Channel"),
    valid: bool(readTag(block, "Valid")),
  };
}

export function parseAgencyLoginResponse(xml: string): MscAgencyLogin {
  const agentId = readTag(xml, "AgentId");
  return {
    authenticated: Boolean(agentId) && !/\<MessageType\>\s*F\s*\<\/MessageType\>/i.test(xml),
    message: readTag(xml, "Message"),
    result: readTag(xml, "Result"),
    agencyCode: readTag(xml, "AgencyCode") ?? readTag(xml, "AdminId"),
    agentId,
    agentName: readTag(xml, "AgentName"),
    agentType: readTag(xml, "AgentType"),
    agentLocation: readTag(xml, "AgentLocation"),
    administrator: bool(readTag(xml, "Administrator")),
    contactName: readTag(xml, "ContactName"),
    officeCode: readTag(xml, "OfficeCode"),
    marketCode: readTag(xml, "MarketCode"),
    currencyCode: readTag(xml, "CurrencyCode"),
    language: readTag(xml, "language"),
    consortiumCode: readTag(xml, "ConsortiumCode"),
    consortiumDescription: readTag(xml, "ConsortiumDescription"),
    iataNo: readTag(xml, "IATANo"),
    payMethod: readTag(xml, "PayMethod"),
    paymentTerm: readTag(xml, "PaymentTerm"),
    viewInvoice: bool(readTag(xml, "ViewInvoice")),
    address: {
      addressId: readTag(xml, "AddressId"),
      addressOne: readTag(xml, "AddressOne"),
      city: readTag(xml, "City"),
      stateCode: readTag(xml, "StateCode"),
      districtCode: readTag(xml, "DistrictCode"),
      countryCode: readTag(xml, "CountryCode"),
      zipPostalCode: readTag(xml, "ZipPostalCode"),
      telephoneNo: readTag(xml, "TelephoneNo"),
      faxNo: readTag(xml, "FaxNo"),
      emailAddress: readTag(xml, "EmailAddress"),
      url: readTag(xml, "Url"),
    },
    representative: {
      firstName: readTag(xml, "RepresentativeFirstname"),
      surname: readTag(xml, "RepresentativeSurname"),
      email: readTag(xml, "RepresentativeEmail"),
      salesPerson: readTag(xml, "SalesPerson"),
      managerName: readTag(xml, "MngName"),
      rmgrCd: readTag(xml, "RmgrCd"),
    },
    securityOverrides: parseSecurityOverrides(xml),
    contractDetail: parseContractDetail(xml),
  };
}
