import { describe, it, expect } from "vitest";
import { parseAgencyLoginResponse } from "../../supabase/functions/_shared/msc-agency-login";

const ok = `<?xml version="1.0" encoding="UTF-8"?><DtsAgencyLoginMessageResponse xmlns="DTS">
<AddressId>53311898</AddressId><AddressOne>VIA DI FRANCIA, 28</AddressOne><AdminId>TESTIT01</AdminId>
<Administrator>true</Administrator><AgentId>TESTIT01</AgentId><AgentLocation>I11</AgentLocation>
<AgentName>MSC CRUISESA</AgentName><AgentType>DC</AgentType><City>GENOVA</City>
<ConsortiumCode>TEST</ConsortiumCode><ConsortiumDescription>TEST NETWORK</ConsortiumDescription>
<ContractDetail><Accepted>true</Accepted><Version>1_0</Version><ContractDate>2018-07-09</ContractDate><Valid>true</Valid></ContractDetail>
<CurrencyCode>EUR</CurrencyCode><MarketCode>ITA</MarketCode><OfficeCode>ITA</OfficeCode>
<PayMethod>AGENCY</PayMethod><PaymentTerm>BEFORE</PaymentTerm>
<RepresentativeFirstname>Test</RepresentativeFirstname><RepresentativeSurname>Test IBS</RepresentativeSurname>
<SecurityOverrides><CannotMakeBookings>No</CannotMakeBookings><CanPayByCC>Yes</CanPayByCC>
<CanPayByCheck>No</CanPayByCheck><DisableBookingView></DisableBookingView></SecurityOverrides>
<ViewInvoice>false</ViewInvoice><ZipPostalCode>16149</ZipPostalCode></DtsAgencyLoginMessageResponse>`;

const failed = `<DtsAgencyLoginMessageResponse xmlns="DTS"><AdvisoryInfo><AdvisoryMessage>
<MessageCode>ACY_010</MessageCode><MessageText>Invalid AgencyID/AgentPassword</MessageText>
<MessageType>F</MessageType></AdvisoryMessage></AdvisoryInfo></DtsAgencyLoginMessageResponse>`;

describe("parseAgencyLoginResponse", () => {
  it("reads agency defaults and contract on success", () => {
    const r = parseAgencyLoginResponse(ok);
    expect(r.authenticated).toBe(true);
    expect(r.agentName).toBe("MSC CRUISESA");
    expect(r.marketCode).toBe("ITA");
    expect(r.currencyCode).toBe("EUR");
    expect(r.administrator).toBe(true);
    expect(r.contractDetail?.valid).toBe(true);
    expect(r.representative.surname).toBe("Test IBS");
  });

  it("normalizes Yes/No security overrides", () => {
    const s = parseAgencyLoginResponse(ok).securityOverrides!;
    expect(s.cannotMakeBookings).toBe(false);
    expect(s.canPayByCC).toBe(true);
    expect(s.canPayByCheck).toBe(false);
    expect(s.disableBookingView).toBe(false);
  });

  it("is not authenticated when AdvisoryInfo reports a failure", () => {
    const r = parseAgencyLoginResponse(failed);
    expect(r.authenticated).toBe(false);
    expect(r.securityOverrides).toBeNull();
  });
});
