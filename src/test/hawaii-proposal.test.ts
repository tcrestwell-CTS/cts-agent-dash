import { describe, it, expect } from "vitest";
import { HAWAII_PROPOSAL_CONFIG } from "@/lib/hawaiiProposal";

describe("approved Hawaii sailing", () => {
  it("offers only November 20–27, 2027", () => {
    expect(HAWAII_PROPOSAL_CONFIG.sailings.map(({ startDate, endDate }) => [startDate, endDate])).toEqual([["2027-11-20", "2027-11-27"]]);
  });

  it.each([
    ["inside", 1899, 3798],
    ["oceanview", 2141, 4282],
    ["balcony", 3025, 6050],
    ["club-balcony", 4897, 9794],
    ["suite", 5423, 10846],
  ])("uses supplied %s lead price and two-person total", (id, perPerson, cabinTotal) => {
    expect(HAWAII_PROPOSAL_CONFIG.sailings[0].cabins.find((cabin) => cabin.id === id)).toMatchObject({ perPerson, cabinTotal });
  });
});