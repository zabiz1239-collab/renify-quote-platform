with incoming (
  id,
  company,
  contact,
  phone,
  email,
  website,
  trades,
  notes
) as (
  values
  ('TAS_LARK_AND_CREESE_SURVEYORS', 'Lark & Creese Surveyors', '', '(03) 6229 6563', 'info@larkandcreese.com.au', 'https://larkandcreese.com.au/', ARRAY['001', '003']::text[], 'Tasmania supplier import. Cost centres: 001 Land Survey; 003 Bushfire Assessment. Source URLs: https://larkandcreese.com.au/'),
  ('TAS_PDA_SURVEYORS_ENGINEERS_AND_PLANNERS', 'PDA Surveyors Engineers & Planners', '', '(03) 6210 1411', 'enquiries@pda.com.au', 'https://www.pda.com.au/', ARRAY['001']::text[], 'Tasmania supplier import. Cost centres: 001 Land Survey. Source URLs: https://www.pda.com.au/'),
  ('TAS_ROGERSON_AND_BIRCH_SURVEYORS', 'Rogerson & Birch Surveyors', 'Andrew Birch', '(03) 6248 5898', 'admin@rbsurveyors.com', 'https://rbsurveyors.com.au/subdividing-hobart-rb-surveyors/', ARRAY['001']::text[], 'Tasmania supplier import. Cost centres: 001 Land Survey. Source URLs: https://rbsurveyors.com.au/subdividing-hobart-rb-surveyors/'),
  ('TAS_GEO_ENVIRONMENTAL_SOLUTIONS_GES', 'Geo-Environmental Solutions (GES)', '', '(03) 6223 1839', 'office@geosolutions.net.au', 'https://www.geosolutions.net.au/', ARRAY['002']::text[], 'Tasmania supplier import. Cost centres: 002 Soil Test. Source URLs: https://www.geosolutions.net.au/'),
  ('TAS_ENVIRO_TECH_CONSULTANTS', 'Enviro-Tech Consultants', '', '0476 595 889', 'team@envirotechtas.com.au', 'https://www.envirotechtas.com.au/', ARRAY['002']::text[], 'Tasmania supplier import. Cost centres: 002 Soil Test. Source URLs: https://www.envirotechtas.com.au/'),
  ('TAS_TAS_BUSHFIRE_CONSULTING', 'Tas Bushfire Consulting', '', '', 'admin@tasbushfire.com.au', 'https://www.tasbushfire.com.au/contact', ARRAY['003']::text[], 'Tasmania supplier import. Cost centres: 003 Bushfire Assessment. Source URLs: https://www.tasbushfire.com.au/contact'),
  ('TAS_FIRE_RISK_CONSULTANTS', 'Fire Risk Consultants', 'Rob Whittle', '0419 510 618', 'rob@fireriskconsultants.com.au', 'https://fireriskconsultants.com.au/home-bushfire-safety-in-tasmania/', ARRAY['003']::text[], 'Tasmania supplier import. Cost centres: 003 Bushfire Assessment. Source URLs: https://fireriskconsultants.com.au/home-bushfire-safety-in-tasmania/'),
  ('TAS_ASPIRE_SUSTAINABILITY', 'Aspire Sustainability', '', '0422 723 900', 'admin@aspiresustainability.com.au', 'https://www.aspiresustainability.com.au/nathers', ARRAY['004']::text[], 'Tasmania supplier import. Cost centres: 004 Energy / NatHERS. Source URLs: https://www.aspiresustainability.com.au/nathers'),
  ('TAS_ENERGY_ASSESSMENTS_TASMANIA', 'Energy Assessments Tasmania', '', '0415 240 937', 'EnergyAssessmentsTasmania@gmail.com', 'https://www.energyassessmentstas.com.au/', ARRAY['004']::text[], 'Tasmania supplier import. Cost centres: 004 Energy / NatHERS. Source URLs: https://www.energyassessmentstas.com.au/'),
  ('TAS_BUILDING_EVALUATE', 'Building eValuate', 'Paul', '0419 312 558', 'paul@buildingevaluate.com.au', 'https://www.buildingevaluate.com.au/', ARRAY['004']::text[], 'Tasmania supplier import. Cost centres: 004 Energy / NatHERS. Source URLs: https://www.buildingevaluate.com.au/'),
  ('TAS_ANOTHER_PERSPECTIVE_DESIGN_AND_DRAFTING', 'Another Perspective Design & Drafting', '', '(03) 6231 4122', 'info@anotherperspective.com.au', 'https://www.anotherperspective.net.au/', ARRAY['005']::text[], 'Tasmania supplier import. Cost centres: 005 Architectural Plans. Source URLs: https://www.anotherperspective.net.au/'),
  ('TAS_MCKINNON_CONSULTING_ENGINEER', 'McKinnon Consulting Engineer', 'David McKinnon', '0402 074 779', 'david@mckengineering.com.au', 'https://www.mckengineering.com.au/', ARRAY['006']::text[], 'Tasmania supplier import. Cost centres: 006 Structural Engineering. Source URLs: https://www.mckengineering.com.au/'),
  ('TAS_INTEGRAL_CONSULTING_ENGINEERS', 'Integral Consulting Engineers', 'Stephen Cole', '', 'stephen@integralengineers.com.au', 'https://www.integralengineers.com.au/services-structural', ARRAY['006']::text[], 'Tasmania supplier import. Cost centres: 006 Structural Engineering. Source URLs: https://www.integralengineers.com.au/services-structural'),
  ('TAS_BUILDING_SURVEYING_TASMANIA', 'Building Surveying Tasmania', '', '(03) 6231 9070', 'admin@bstas.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_FREESTONE_BUILDING_SURVEYING', 'Freestone Building Surveying', 'Mark Schmidt', '(03) 6124 2220', 'admin@freestonetas.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_HOLDFAST_BUILDING_SURVEYING', 'Holdfast Building Surveying', 'Nigel Grice', '(03) 6231 5717', 'admin@holdfasttas.com', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_LEE_TYERS_BUILDING_SURVEYORS', 'Lee Tyers Building Surveyors', '', '(03) 6229 2440', 'admin@ltbs.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_PITT_AND_SHERRY_BUILDING_SURVEYING', 'Pitt & Sherry Building Surveying', '', '(03) 6210 1450', 'buildingsurveying@pittsh.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_JOE_MAMIC_AND_ASSOCIATES_PTY_LTD', 'Joe Mamic & Associates Pty Ltd', '', '(03) 6231 4422', 'office@mamic.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_PUDDING_LANE_BUILDING_SURVEYORS', 'Pudding Lane Building Surveyors', '', '(03) 6295 5563', 'admin@puddingln.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_ASSET_BUILDING_SURVEYING', 'Asset Building Surveying', 'Michael Westcott', '0407 796 978', 'office@abstas.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_RESIDENTIAL_BUILDING_SURVEYING', 'Residential Building Surveying', 'James Haw', '0406 656 423', 'james@resibuilds.com.au', 'https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf', ARRAY['009']::text[], 'Tasmania supplier import. Cost centres: 009 Building Permit (Surveyor). Source URLs: https://www.sorell.tas.gov.au/wp-content/uploads/2025/05/Building-Surveying-List-2025.pdf'),
  ('TAS_BRIGHTON_COUNCIL_BUILDING_AND_PLUMBING_OFFICE', 'Brighton Council Building & Plumbing Office', '', '(03) 6268 7016', 'admin@brighton.tas.gov.au', 'https://www.brighton.tas.gov.au/planning/building-and-plumbing/', ARRAY['010']::text[], 'Tasmania supplier import. Cost centres: 010 Plumbing Permit (Council/Surveyor). Source URLs: https://www.brighton.tas.gov.au/planning/building-and-plumbing/'),
  ('TAS_HEADLAM_HOWLETT_EXCAVATIONS_PTY_LTD', 'Headlam Howlett Excavations Pty Ltd', '', '(03) 6260 2452', 'admin@headlamhowlett.com.au', 'https://www.headlamhowlett.com.au/', ARRAY['055']::text[], 'Tasmania supplier import. Cost centres: 055 Excavation. Source URLs: https://www.headlamhowlett.com.au/'),
  ('TAS_MCKAY_TIMBER', 'McKay Timber', '', '(03) 6272 6941', 'mckaytimber@mckaytimber.com.au', 'https://www.mckaytimber.com.au/timber-trusses-frames', ARRAY['145']::text[], 'Tasmania supplier import. Cost centres: 145 Frame & Truss. Source URLs: https://www.mckaytimber.com.au/timber-trusses-frames'),
  ('TAS_RICHARDS_ALUMINIUM', 'Richards Aluminium', '', '(03) 6244 6791', 'info@richardsaluminium.com.au', 'https://www.facebook.com/Richards.Aluminium/', ARRAY['270']::text[], 'Tasmania supplier import. Cost centres: 270 Windows. Source URLs: https://www.facebook.com/Richards.Aluminium/'),
  ('TAS_TITANE_WINDOWS_AND_DOORS', 'Titane Windows & Doors', 'Gary or Glen Beveridge', '(03) 6248 4601', 'sales@titane.com.au', 'https://www.titaneupvcdoubleglazing.com.au/', ARRAY['270']::text[], 'Tasmania supplier import. Cost centres: 270 Windows. Source URLs: https://www.titaneupvcdoubleglazing.com.au/'),
  ('TAS_MASTER_PLUMBERS_ASSOCIATION_OF_TASMANIA_INDUST', 'Master Plumbers Association of Tasmania (industry body for licensed referrals)', '', '', 'contact@mpatas.com.au', 'https://www.mpatas.com.au/index.php/find-a-plumber', ARRAY['315']::text[], 'Tasmania supplier import. Cost centres: 315 Plumber. Source URLs: https://www.mpatas.com.au/index.php/find-a-plumber'),
  ('TAS_EJ_AND_DJ_PLUMBERS', 'EJ & DJ Plumbers', 'Danny', '0417 123 927', 'danny@ejanddjplumbers.com.au', 'https://www.mpatas.com.au/index.php/find-a-plumber', ARRAY['315']::text[], 'Tasmania supplier import. Cost centres: 315 Plumber. Source URLs: https://www.mpatas.com.au/index.php/find-a-plumber'),
  ('TAS_HIB_ELECTRICAL_AIR_AND_SOLAR', 'HIB Electrical, Air & Solar', '', '0400 336 287', 'info@hibelectrical.com.au', 'https://www.hibelectrical.com.au/', ARRAY['325', '330']::text[], 'Tasmania supplier import. Cost centres: 325 Electrician; 330 Solar PV. Source URLs: https://www.hibelectrical.com.au/'),
  ('TAS_REST_ENERGY_RENEWABLE_ENERGY_SOLUTIONS_TASMANI', 'REST Energy (Renewable Energy Solutions Tasmania)', 'George Auchterlonie', '0439 750 418', 'info@restenergy.com.au', 'https://www.restenergy.com.au/', ARRAY['330']::text[], 'Tasmania supplier import. Cost centres: 330 Solar PV. Source URLs: https://www.restenergy.com.au/')
),
updated as (
  update public.qp_suppliers s
  set
    contact = case when coalesce(s.contact, '') = '' then i.contact else s.contact end,
    phone = case when coalesce(s.phone, '') = '' then i.phone else s.phone end,
    website = case when coalesce(s.website, '') = '' then i.website else s.website end,
    trades = (
      select array_agg(distinct value order by value)
      from unnest(coalesce(s.trades, '{}'::text[]) || i.trades) as merged(value)
    ),
    regions = (
      select array_agg(distinct value order by value)
      from unnest(coalesce(s.regions, '{}'::text[]) || ARRAY['Tasmania']::text[]) as merged(value)
    ),
    status = case when s.status = 'blacklisted' then s.status else 'verified' end,
    rating = coalesce(s.rating, 3),
    notes = case
      when coalesce(s.notes, '') ilike '%Tasmania supplier import%' then s.notes
      else concat_ws(E'\n', nullif(s.notes, ''), i.notes)
    end,
    attachment_preferences = coalesce(s.attachment_preferences, '{}'::jsonb)
  from incoming i
  where lower(coalesce(s.email, '')) = lower(i.email)
     or lower(s.company) = lower(i.company)
  returning s.id
)
insert into public.qp_suppliers (
  id,
  company,
  contact,
  email,
  phone,
  abn,
  website,
  cc,
  trades,
  regions,
  status,
  rating,
  notes,
  last_contacted,
  attachment_preferences
)
select
  i.id,
  i.company,
  i.contact,
  i.email,
  i.phone,
  null,
  i.website,
  null,
  i.trades,
  ARRAY['Tasmania']::text[],
  'verified',
  3,
  i.notes,
  null,
  '{}'::jsonb
from incoming i
where not exists (
  select 1
  from public.qp_suppliers s
  where lower(coalesce(s.email, '')) = lower(i.email)
     or lower(s.company) = lower(i.company)
);
