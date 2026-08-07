import { describe, it, expect } from "vitest";
import { parseSearchCruisesResponse } from "../../supabase/functions/_shared/msc-search-parse";

const xml = `<DtsSearchCruisesResponseV1 xmlns="DTS"><Itinerary>
<BestPrice><BestPriceCruiseId>MR20190202GOAGOA</BestPriceCruiseId><BestPriceShipCd>MR</BestPriceShipCd>
<BestPriceShipName>MSC MERAVIGLIA</BestPriceShipName><BestPriceDepartureDate>2019-02-02</BestPriceDepartureDate>
<BestPriceCategory>I1</BestPriceCategory><BestPriceCode>MRW19ITAB0702</BestPriceCode>
<BestPriceCabinPrice>798.0</BestPriceCabinPrice><BestPriceTotalCabinPrice>1078.00</BestPriceTotalCabinPrice>
<BestPriceCabinsAvailable>45</BestPriceCabinsAvailable></BestPrice>
<Cruises><AirMandatory>false</AirMandatory><CruiseId>MR20190202GOAGOA</CruiseId><ShipCd>MR</ShipCd>
<ShipName>MSC MERAVIGLIA</ShipName><DepartureDate>2019-02-02</DepartureDate><ArrivalDate>2019-02-09</ArrivalDate>
<CruiseLen>7</CruiseLen><EmbkPort>GOA</EmbkPort><DisembkPort>GOA</DisembkPort><Category>BB</Category>
<PricedCategory>BB</PricedCategory><PricedOccupancy>2</PricedOccupancy><PriceCode>MRW19ITAB0702</PriceCode>
<PriceType>EARLYBKG</PriceType><CurrencyCd>EUR</CurrencyCd><CabinPrice>900.0</CabinPrice>
<TotalCabinPrice>1000.00</TotalCabinPrice><PortChargesAmt>140.00</PortChargesAmt><GFTTAdt>70.0</GFTTAdt>
<CabinsAvailable>12</CabinsAvailable><InstantConfirm>Y</InstantConfirm>
<ServiceChargeItems><ServiceChargeItemDetails><ServiceChargeType>PROMO</ServiceChargeType>
<ServiceChargeCode>SC1</ServiceChargeCode><ServiceChargeAdult>10.0</ServiceChargeAdult>
<TotalServiceCharge>140.00</TotalServiceCharge><Standard>false</Standard></ServiceChargeItemDetails>
</ServiceChargeItems></Cruises></Itinerary></DtsSearchCruisesResponseV1>`;

describe("parseSearchCruisesResponse", () => {
  it("reads the best price block", () => {
    const { bestPrice } = parseSearchCruisesResponse(xml);
    expect(bestPrice?.cruiseId).toBe("MR20190202GOAGOA");
    expect(bestPrice?.totalCabinPrice).toBe(1078);
  });

  it("flattens priced categories with separated charges", () => {
    const { cruises } = parseSearchCruisesResponse(xml);
    expect(cruises).toHaveLength(1);
    const c = cruises[0];
    expect(c.category).toBe("BB");
    expect(c.gftAdult).toBe(70);
    expect(c.serviceCharges[0].total).toBe(140);
    expect(c.airMandatory).toBe(false);
    // cabin (1000, incl NCF) + port charges (140) + service charges (140)
    expect(c.computedTotal).toBe(1280);
  });

  it("returns empty results for an unrelated document", () => {
    expect(parseSearchCruisesResponse("<Other/>").cruises).toEqual([]);
  });
});
