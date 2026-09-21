/**
 * US / Canada (NANP) area code → primary city / region lookup.
 * Used to give agents a quick sense of where a lead is likely calling from.
 * Unknown codes return null so the UI can simply omit the badge.
 */
export const AREA_CODES: Record<string, string> = {
  // ─── United States ──────────────────────────────────────────────────────────
  "201": "Jersey City, NJ", "202": "Washington, DC", "203": "Bridgeport, CT",
  "205": "Birmingham, AL", "206": "Seattle, WA", "207": "Portland, ME",
  "208": "Boise, ID", "209": "Stockton, CA", "210": "San Antonio, TX",
  "212": "New York, NY", "213": "Los Angeles, CA", "214": "Dallas, TX",
  "215": "Philadelphia, PA", "216": "Cleveland, OH", "217": "Springfield, IL",
  "218": "Duluth, MN", "219": "Gary, IN", "220": "Newark, OH",
  "223": "Harrisburg, PA", "224": "Evanston, IL", "225": "Baton Rouge, LA",
  "228": "Gulfport, MS", "229": "Albany, GA", "231": "Muskegon, MI",
  "234": "Akron, OH", "239": "Fort Myers, FL", "240": "Silver Spring, MD",
  "248": "Troy, MI", "251": "Mobile, AL", "252": "Greenville, NC",
  "253": "Tacoma, WA", "254": "Killeen, TX", "256": "Huntsville, AL",
  "260": "Fort Wayne, IN", "262": "Kenosha, WI", "267": "Philadelphia, PA",
  "269": "Kalamazoo, MI", "270": "Bowling Green, KY", "272": "Scranton, PA",
  "276": "Bristol, VA", "279": "Sacramento, CA", "281": "Houston, TX",
  "301": "Rockville, MD", "302": "Wilmington, DE", "303": "Denver, CO",
  "304": "Charleston, WV", "305": "Miami, FL", "307": "Cheyenne, WY",
  "308": "Grand Island, NE", "309": "Peoria, IL", "310": "Santa Monica, CA",
  "312": "Chicago, IL", "313": "Detroit, MI", "314": "St. Louis, MO",
  "315": "Syracuse, NY", "316": "Wichita, KS", "317": "Indianapolis, IN",
  "318": "Shreveport, LA", "319": "Cedar Rapids, IA", "320": "St. Cloud, MN",
  "321": "Orlando, FL", "323": "Los Angeles, CA", "325": "Abilene, TX",
  "330": "Youngstown, OH", "331": "Aurora, IL", "334": "Montgomery, AL",
  "336": "Greensboro, NC", "337": "Lafayette, LA", "339": "Boston, MA",
  "346": "Houston, TX", "347": "New York, NY", "351": "Lowell, MA",
  "352": "Gainesville, FL", "360": "Bellingham, WA", "361": "Corpus Christi, TX",
  "364": "Bowling Green, KY", "380": "Columbus, OH", "385": "Salt Lake City, UT",
  "386": "Daytona Beach, FL", "401": "Providence, RI", "402": "Omaha, NE",
  "404": "Atlanta, GA", "405": "Oklahoma City, OK", "406": "Billings, MT",
  "407": "Orlando, FL", "408": "San Jose, CA", "409": "Beaumont, TX",
  "410": "Baltimore, MD", "412": "Pittsburgh, PA", "413": "Springfield, MA",
  "414": "Milwaukee, WI", "415": "San Francisco, CA", "417": "Springfield, MO",
  "419": "Toledo, OH", "423": "Chattanooga, TN", "424": "Los Angeles, CA",
  "425": "Bellevue, WA", "430": "Tyler, TX", "432": "Midland, TX",
  "434": "Charlottesville, VA", "435": "St. George, UT", "440": "Cleveland, OH",
  "442": "Oceanside, CA", "443": "Baltimore, MD", "458": "Eugene, OR",
  "463": "Indianapolis, IN", "469": "Dallas, TX", "470": "Atlanta, GA",
  "475": "New Haven, CT", "478": "Macon, GA", "479": "Fort Smith, AR",
  "480": "Mesa, AZ", "484": "Allentown, PA", "501": "Little Rock, AR",
  "502": "Louisville, KY", "503": "Portland, OR", "504": "New Orleans, LA",
  "505": "Albuquerque, NM", "507": "Rochester, MN", "508": "Worcester, MA",
  "509": "Spokane, WA", "510": "Oakland, CA", "512": "Austin, TX",
  "513": "Cincinnati, OH", "515": "Des Moines, IA", "516": "Hempstead, NY",
  "517": "Lansing, MI", "518": "Albany, NY", "520": "Tucson, AZ",
  "530": "Redding, CA", "531": "Omaha, NE", "534": "Eau Claire, WI",
  "539": "Tulsa, OK", "540": "Roanoke, VA", "541": "Eugene, OR",
  "551": "Jersey City, NJ", "559": "Fresno, CA", "561": "West Palm Beach, FL",
  "562": "Long Beach, CA", "563": "Davenport, IA", "567": "Toledo, OH",
  "570": "Scranton, PA", "571": "Arlington, VA", "573": "Columbia, MO",
  "574": "South Bend, IN", "575": "Las Cruces, NM", "580": "Lawton, OK",
  "585": "Rochester, NY", "586": "Warren, MI", "601": "Jackson, MS",
  "602": "Phoenix, AZ", "603": "Manchester, NH", "605": "Sioux Falls, SD",
  "606": "Ashland, KY", "607": "Binghamton, NY", "608": "Madison, WI",
  "609": "Trenton, NJ", "610": "Allentown, PA", "612": "Minneapolis, MN",
  "614": "Columbus, OH", "615": "Nashville, TN", "616": "Grand Rapids, MI",
  "617": "Boston, MA", "618": "Belleville, IL", "619": "San Diego, CA",
  "620": "Dodge City, KS", "623": "Glendale, AZ", "626": "Pasadena, CA",
  "628": "San Francisco, CA", "629": "Nashville, TN", "630": "Naperville, IL",
  "631": "Brentwood, NY", "636": "St. Charles, MO", "641": "Mason City, IA",
  "646": "New York, NY", "650": "San Mateo, CA", "651": "St. Paul, MN",
  "657": "Anaheim, CA", "660": "Sedalia, MO", "661": "Bakersfield, CA",
  "662": "Tupelo, MS", "667": "Baltimore, MD", "669": "San Jose, CA",
  "678": "Atlanta, GA", "681": "Charleston, WV", "682": "Fort Worth, TX",
  "684": "American Samoa", "689": "Orlando, FL", "701": "Fargo, ND",
  "702": "Las Vegas, NV", "703": "Arlington, VA", "704": "Charlotte, NC",
  "706": "Augusta, GA", "707": "Santa Rosa, CA", "708": "Cicero, IL",
  "712": "Sioux City, IA", "713": "Houston, TX", "714": "Anaheim, CA",
  "715": "Eau Claire, WI", "716": "Buffalo, NY", "717": "Lancaster, PA",
  "718": "New York, NY", "719": "Colorado Springs, CO", "720": "Denver, CO",
  "724": "New Castle, PA", "725": "Las Vegas, NV", "727": "St. Petersburg, FL",
  "731": "Jackson, TN", "732": "Toms River, NJ", "734": "Ann Arbor, MI",
  "737": "Austin, TX", "740": "Zanesville, OH", "743": "Greensboro, NC",
  "747": "Los Angeles, CA", "754": "Fort Lauderdale, FL", "757": "Norfolk, VA",
  "758": "St. Lucia", "760": "Oceanside, CA", "762": "Augusta, GA",
  "763": "Brooklyn Park, MN", "765": "Muncie, IN", "769": "Jackson, MS",
  "770": "Marietta, GA", "772": "Port St. Lucie, FL", "773": "Chicago, IL",
  "774": "Worcester, MA", "775": "Reno, NV", "779": "Rockford, IL",
  "781": "Lynn, MA", "784": "St. Vincent", "785": "Topeka, KS",
  "786": "Miami, FL", "787": "Puerto Rico", "801": "Salt Lake City, UT",
  "802": "Burlington, VT", "803": "Columbia, SC", "804": "Richmond, VA",
  "805": "Oxnard, CA", "806": "Lubbock, TX", "808": "Honolulu, HI",
  "809": "Dominican Republic", "810": "Flint, MI", "812": "Evansville, IN",
  "813": "Tampa, FL", "814": "Erie, PA", "815": "Rockford, IL",
  "816": "Kansas City, MO", "817": "Fort Worth, TX", "818": "Los Angeles, CA",
  "819": "Gatineau, QC", "828": "Asheville, NC", "829": "Dominican Republic",
  "830": "New Braunfels, TX", "831": "Salinas, CA", "832": "Houston, TX",
  "843": "Charleston, SC", "845": "Poughkeepsie, NY", "847": "Arlington Heights, IL",
  "848": "Toms River, NJ", "849": "Dominican Republic", "850": "Tallahassee, FL",
  "854": "Charleston, SC", "856": "Camden, NJ", "857": "Boston, MA",
  "858": "San Diego, CA", "859": "Lexington, KY", "860": "Hartford, CT",
  "862": "Newark, NJ", "863": "Lakeland, FL", "864": "Greenville, SC",
  "865": "Knoxville, TN", "867": "Yukon / NWT, Canada", "868": "Trinidad & Tobago",
  "869": "St. Kitts & Nevis", "870": "Jonesboro, AR", "872": "Chicago, IL",
  "876": "Jamaica", "878": "Pittsburgh, PA", "901": "Memphis, TN",
  "903": "Tyler, TX", "904": "Jacksonville, FL", "906": "Marquette, MI",
  "907": "Anchorage, AK", "908": "Elizabeth, NJ", "909": "San Bernardino, CA",
  "910": "Fayetteville, NC", "912": "Savannah, GA", "913": "Overland Park, KS",
  "914": "Yonkers, NY", "915": "El Paso, TX", "916": "Sacramento, CA",
  "917": "New York, NY", "918": "Tulsa, OK", "919": "Raleigh, NC",
  "920": "Green Bay, WI", "925": "Concord, CA", "928": "Yuma, AZ",
  "929": "New York, NY", "930": "Evansville, IN", "931": "Clarksville, TN",
  "935": "San Diego, CA", "936": "Conroe, TX", "937": "Dayton, OH",
  "938": "Huntsville, AL", "939": "Puerto Rico", "940": "Denton, TX",
  "941": "Sarasota, FL", "947": "Troy, MI", "949": "Irvine, CA",
  "951": "Riverside, CA", "952": "Bloomington, MN", "954": "Fort Lauderdale, FL",
  "956": "Laredo, TX", "959": "Hartford, CT", "970": "Fort Collins, CO",
  "971": "Portland, OR", "972": "Dallas, TX", "973": "Newark, NJ",
  "978": "Lowell, MA", "979": "College Station, TX", "980": "Charlotte, NC",
  "984": "Raleigh, NC", "985": "Houma, LA", "986": "Boise, ID",
  "989": "Saginaw, MI",

  // ─── Canada ─────────────────────────────────────────────────────────────────
  "204": "Winnipeg, MB", "226": "London, ON", "236": "Vancouver, BC",
  "249": "Sudbury, ON", "250": "Victoria, BC", "289": "Hamilton, ON",
  "306": "Regina, SK", "343": "Ottawa, ON", "354": "Quebec, QC",
  "365": "Hamilton, ON", "367": "Quebec, QC", "368": "Calgary, AB",
  "403": "Calgary, AB", "416": "Toronto, ON", "418": "Quebec, QC",
  "428": "New Brunswick", "431": "Winnipeg, MB", "437": "Toronto, ON",
  "438": "Montreal, QC", "450": "Laval, QC", "468": "Quebec, QC",
  "474": "Saskatoon, SK", "506": "New Brunswick", "514": "Montreal, QC",
  "519": "London, ON", "579": "Montreal, QC", "581": "Quebec, QC",
  "584": "Manitoba", "587": "Calgary, AB", "604": "Vancouver, BC",
  "613": "Ottawa, ON", "639": "Saskatoon, SK", "647": "Toronto, ON",
  "672": "Vancouver, BC", "683": "Sudbury, ON", "705": "Sudbury, ON",
  "709": "Newfoundland", "742": "Ontario", "753": "Ottawa, ON",
  "778": "Vancouver, BC", "780": "Edmonton, AB", "782": "Nova Scotia",
  "807": "Thunder Bay, ON", "825": "Calgary, AB", "873": "Gatineau, QC",
  "879": "Newfoundland", "902": "Nova Scotia", "905": "Mississauga, ON",

  // ─── Caribbean / other NANP ─────────────────────────────────────────────────
  "242": "Bahamas", "246": "Barbados", "264": "Anguilla",
  "268": "Antigua & Barbuda", "284": "British Virgin Islands", "340": "US Virgin Islands",
  "345": "Cayman Islands", "441": "Bermuda", "473": "Grenada",
  "649": "Turks & Caicos", "664": "Montserrat", "670": "Northern Mariana Islands",
  "671": "Guam", "721": "Sint Maarten", "767": "Dominica",
};

const TOLL_FREE = new Set(["800", "833", "844", "855", "866", "877", "888"]);

/**
 * Extract the NANP area code from a free-form phone string and return the
 * matching city/region label, or null when it can't be determined.
 */
export function getAreaCodeRegion(phone?: string | null): { areaCode: string; region: string } | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  // Strip a leading country code 1 (11-digit NANP numbers)
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length < 10) return null;
  // Longer strings: take the last 10 digits (handles +001, extensions poorly-formatted, etc.)
  if (digits.length > 10) digits = digits.slice(-10);
  const areaCode = digits.slice(0, 3);
  if (TOLL_FREE.has(areaCode)) return { areaCode, region: "Toll-free" };
  const region = AREA_CODES[areaCode];
  if (!region) return null;
  return { areaCode, region };
}
