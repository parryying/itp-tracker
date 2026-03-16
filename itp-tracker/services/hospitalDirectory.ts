/**
 * Epic FHIR Endpoint Directory
 * 
 * Each hospital running Epic has its own FHIR endpoint.
 * The client_id registered at open.epic.com works across all participating organizations.
 * 
 * Endpoints sourced from: https://open.epic.com/MyApps/Endpoints
 */

export interface HospitalEndpoint {
  id: string;
  name: string;
  location: string;
  fhirBaseUrl: string;
  authUrl: string;
  tokenUrl: string;
  logo?: string;
}

// Major Epic hospitals with their FHIR R4 endpoints
const HOSPITAL_DIRECTORY: HospitalEndpoint[] = [
  // ─── User's hospitals (prioritized) ────────────────────────────
  {
    id: 'seattle-childrens',
    name: "Seattle Children's Hospital",
    location: 'Seattle, WA',
    fhirBaseUrl: 'https://fhir.seattlechildrens.org/fhir-prd/api/FHIR/R4',
    authUrl: 'https://fhir.seattlechildrens.org/fhir-prd/oauth2/authorize',
    tokenUrl: 'https://fhir.seattlechildrens.org/fhir-prd/oauth2/token',
  },
  {
    id: 'ucla-health',
    name: 'UCLA Health',
    location: 'Los Angeles, CA',
    fhirBaseUrl: 'https://connect.uclahealth.org/FHIR/api/FHIR/R4',
    authUrl: 'https://connect.uclahealth.org/FHIR/oauth2/authorize',
    tokenUrl: 'https://connect.uclahealth.org/FHIR/oauth2/token',
  },

  // ─── Major health systems (alphabetical) ───────────────────────
  {
    id: 'banner-health',
    name: 'Banner Health',
    location: 'Phoenix, AZ',
    fhirBaseUrl: 'https://eprescribing.bannerhealth.com/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://eprescribing.bannerhealth.com/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://eprescribing.bannerhealth.com/FHIR-PRD/oauth2/token',
  },
  {
    id: 'boston-childrens',
    name: "Boston Children's Hospital",
    location: 'Boston, MA',
    fhirBaseUrl: 'https://fhir.childrens.harvard.edu/open-prd/api/FHIR/R4',
    authUrl: 'https://fhir.childrens.harvard.edu/open-prd/oauth2/authorize',
    tokenUrl: 'https://fhir.childrens.harvard.edu/open-prd/oauth2/token',
  },
  {
    id: 'cedars-sinai',
    name: 'Cedars-Sinai Medical Center',
    location: 'Los Angeles, CA',
    fhirBaseUrl: 'https://mychart.csmc.edu/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://mychart.csmc.edu/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://mychart.csmc.edu/FHIRProxy/oauth2/token',
  },
  {
    id: 'childrens-hospital-colorado',
    name: "Children's Hospital Colorado",
    location: 'Aurora, CO',
    fhirBaseUrl: 'https://epicproxy.childrenscolorado.org/FHIR/api/FHIR/R4',
    authUrl: 'https://epicproxy.childrenscolorado.org/FHIR/oauth2/authorize',
    tokenUrl: 'https://epicproxy.childrenscolorado.org/FHIR/oauth2/token',
  },
  {
    id: 'childrens-hospital-philly',
    name: "Children's Hospital of Philadelphia",
    location: 'Philadelphia, PA',
    fhirBaseUrl: 'https://epicproxy.chop.edu/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://epicproxy.chop.edu/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://epicproxy.chop.edu/FHIRProxy/oauth2/token',
  },
  {
    id: 'cincinnati-childrens',
    name: "Cincinnati Children's Hospital",
    location: 'Cincinnati, OH',
    fhirBaseUrl: 'https://epicfhir.cchmc.org/FHIR/api/FHIR/R4',
    authUrl: 'https://epicfhir.cchmc.org/FHIR/oauth2/authorize',
    tokenUrl: 'https://epicfhir.cchmc.org/FHIR/oauth2/token',
  },
  {
    id: 'cleveland-clinic',
    name: 'Cleveland Clinic',
    location: 'Cleveland, OH',
    fhirBaseUrl: 'https://epicproxy.et0502.epichosted.com/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://epicproxy.et0502.epichosted.com/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://epicproxy.et0502.epichosted.com/FHIRProxy/oauth2/token',
  },
  {
    id: 'duke-health',
    name: 'Duke Health',
    location: 'Durham, NC',
    fhirBaseUrl: 'https://health-apis.duke.edu/FHIR/patient/api/FHIR/R4',
    authUrl: 'https://health-apis.duke.edu/FHIR/patient/oauth2/authorize',
    tokenUrl: 'https://health-apis.duke.edu/FHIR/patient/oauth2/token',
  },
  {
    id: 'emory-healthcare',
    name: 'Emory Healthcare',
    location: 'Atlanta, GA',
    fhirBaseUrl: 'https://epicrp.emoryhealthcare.org/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://epicrp.emoryhealthcare.org/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://epicrp.emoryhealthcare.org/FHIR-PRD/oauth2/token',
  },
  {
    id: 'johns-hopkins',
    name: 'Johns Hopkins Medicine',
    location: 'Baltimore, MD',
    fhirBaseUrl: 'https://epicproxy.johnshopkins.edu/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://epicproxy.johnshopkins.edu/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://epicproxy.johnshopkins.edu/FHIR-PRD/oauth2/token',
  },
  {
    id: 'kaiser-norcal',
    name: 'Kaiser Permanente (Northern CA)',
    location: 'Oakland, CA',
    fhirBaseUrl: 'https://epicfhir.kp.org/FHIR/api/FHIR/R4',
    authUrl: 'https://epicfhir.kp.org/FHIR/oauth2/authorize',
    tokenUrl: 'https://epicfhir.kp.org/FHIR/oauth2/token',
  },
  {
    id: 'kaiser-socal',
    name: 'Kaiser Permanente (Southern CA)',
    location: 'Pasadena, CA',
    fhirBaseUrl: 'https://epicfhir.kp.org/FHIR/api/FHIR/R4',
    authUrl: 'https://epicfhir.kp.org/FHIR/oauth2/authorize',
    tokenUrl: 'https://epicfhir.kp.org/FHIR/oauth2/token',
  },
  {
    id: 'mass-general-brigham',
    name: 'Mass General Brigham',
    location: 'Boston, MA',
    fhirBaseUrl: 'https://epicproxy.et0965.epichosted.com/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://epicproxy.et0965.epichosted.com/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://epicproxy.et0965.epichosted.com/FHIRProxy/oauth2/token',
  },
  {
    id: 'mayo-clinic',
    name: 'Mayo Clinic',
    location: 'Rochester, MN',
    fhirBaseUrl: 'https://epicfhir.mayo.edu/FHIR/api/FHIR/R4',
    authUrl: 'https://epicfhir.mayo.edu/FHIR/oauth2/authorize',
    tokenUrl: 'https://epicfhir.mayo.edu/FHIR/oauth2/token',
  },
  {
    id: 'mount-sinai',
    name: 'Mount Sinai Health System',
    location: 'New York, NY',
    fhirBaseUrl: 'https://epicfhir.mountsinai.org/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://epicfhir.mountsinai.org/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://epicfhir.mountsinai.org/FHIRProxy/oauth2/token',
  },
  {
    id: 'northwestern-medicine',
    name: 'Northwestern Medicine',
    location: 'Chicago, IL',
    fhirBaseUrl: 'https://epicfhir.nmh.org/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://epicfhir.nmh.org/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://epicfhir.nmh.org/FHIR-PRD/oauth2/token',
  },
  {
    id: 'nyu-langone',
    name: 'NYU Langone Health',
    location: 'New York, NY',
    fhirBaseUrl: 'https://epicfhir.nyumc.org/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://epicfhir.nyumc.org/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://epicfhir.nyumc.org/FHIR-PRD/oauth2/token',
  },
  {
    id: 'ochsner-health',
    name: 'Ochsner Health',
    location: 'New Orleans, LA',
    fhirBaseUrl: 'https://epicmobile.ochsner.org/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://epicmobile.ochsner.org/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://epicmobile.ochsner.org/FHIR-PRD/oauth2/token',
  },
  {
    id: 'providence',
    name: 'Providence Health',
    location: 'Multiple Locations',
    fhirBaseUrl: 'https://haikuor.providence.org/fhirproxy/api/FHIR/R4',
    authUrl: 'https://haikuor.providence.org/fhirproxy/oauth2/authorize',
    tokenUrl: 'https://haikuor.providence.org/fhirproxy/oauth2/token',
  },
  {
    id: 'stanford-health',
    name: 'Stanford Health Care',
    location: 'Palo Alto, CA',
    fhirBaseUrl: 'https://epicfhir.stanfordhealth.org/FHIR/api/FHIR/R4',
    authUrl: 'https://epicfhir.stanfordhealth.org/FHIR/oauth2/authorize',
    tokenUrl: 'https://epicfhir.stanfordhealth.org/FHIR/oauth2/token',
  },
  {
    id: 'uc-davis',
    name: 'UC Davis Health',
    location: 'Sacramento, CA',
    fhirBaseUrl: 'https://epicproxy.et0893.epichosted.com/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://epicproxy.et0893.epichosted.com/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://epicproxy.et0893.epichosted.com/FHIRProxy/oauth2/token',
  },
  {
    id: 'ucsf-health',
    name: 'UCSF Health',
    location: 'San Francisco, CA',
    fhirBaseUrl: 'https://unified-api.ucsf.edu/clinical/apex/api/FHIR/R4',
    authUrl: 'https://unified-api.ucsf.edu/clinical/apex/oauth2/authorize',
    tokenUrl: 'https://unified-api.ucsf.edu/clinical/apex/oauth2/token',
  },
  {
    id: 'unc-health',
    name: 'UNC Health',
    location: 'Chapel Hill, NC',
    fhirBaseUrl: 'https://epicproxy.et0883.epichosted.com/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://epicproxy.et0883.epichosted.com/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://epicproxy.et0883.epichosted.com/FHIRProxy/oauth2/token',
  },
  {
    id: 'upmc',
    name: 'UPMC (Univ. of Pittsburgh Medical Center)',
    location: 'Pittsburgh, PA',
    fhirBaseUrl: 'https://epicproxy-pub.upmc.com/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://epicproxy-pub.upmc.com/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://epicproxy-pub.upmc.com/FHIR-PRD/oauth2/token',
  },
  {
    id: 'uw-medicine',
    name: 'UW Medicine',
    location: 'Seattle, WA',
    fhirBaseUrl: 'https://epicproxy.uwmedicine.org/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://epicproxy.uwmedicine.org/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://epicproxy.uwmedicine.org/FHIR-PRD/oauth2/token',
  },
  {
    id: 'vanderbilt',
    name: 'Vanderbilt University Medical Center',
    location: 'Nashville, TN',
    fhirBaseUrl: 'https://arr.vumc.org/FHIR-PRD/api/FHIR/R4',
    authUrl: 'https://arr.vumc.org/FHIR-PRD/oauth2/authorize',
    tokenUrl: 'https://arr.vumc.org/FHIR-PRD/oauth2/token',
  },
  {
    id: 'yale-new-haven',
    name: 'Yale New Haven Health',
    location: 'New Haven, CT',
    fhirBaseUrl: 'https://epicproxy.ynhhs.org/FHIRProxy/api/FHIR/R4',
    authUrl: 'https://epicproxy.ynhhs.org/FHIRProxy/oauth2/authorize',
    tokenUrl: 'https://epicproxy.ynhhs.org/FHIRProxy/oauth2/token',
  },

  // ─── Epic sandbox (for testing) ────────────────────────────────
  {
    id: 'epic-sandbox',
    name: 'Epic Sandbox (Test)',
    location: 'Test Environment',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    authUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    logo: '🧪',
  },
];

/**
 * Search hospitals by name or location
 */
export function searchHospitals(query: string): HospitalEndpoint[] {
  if (!query || query.length < 2) return HOSPITAL_DIRECTORY;

  const q = query.toLowerCase();
  return HOSPITAL_DIRECTORY.filter(
    (h) =>
      h.name.toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q)
  );
}

/**
 * Get a hospital by its ID
 */
export function getHospitalById(id: string): HospitalEndpoint | undefined {
  return HOSPITAL_DIRECTORY.find((h) => h.id === id);
}

/**
 * Get all hospitals
 */
export function getAllHospitals(): HospitalEndpoint[] {
  return HOSPITAL_DIRECTORY;
}
