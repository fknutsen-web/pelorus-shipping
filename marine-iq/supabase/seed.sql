-- Marine IQ — reference + demo seed data.
-- Safe to run once after migrations. Demo companies/software/conferences are
-- generic placeholders, not real organizations.

insert into sectors (slug, name) values
  ('dry-bulk', 'Dry Bulk'),
  ('tankers', 'Tankers'),
  ('gas', 'Gas (LNG/LPG)'),
  ('containers', 'Containers'),
  ('offshore', 'Offshore & Energy'),
  ('ship-management', 'Ship Management'),
  ('ports-terminals', 'Ports & Terminals'),
  ('shipbroking', 'Shipbroking'),
  ('agency', 'Port Agency'),
  ('insurance-pandi', 'Marine Insurance & P&I'),
  ('maritime-law', 'Maritime Law & Arbitration'),
  ('classification', 'Classification & Survey'),
  ('maritime-tech', 'Maritime Technology'),
  ('cargo-owner', 'Cargo Owners & Charterers'),
  ('bunkering', 'Bunkering'),
  ('crewing', 'Crewing & Manning'),
  ('other', 'Other')
on conflict (slug) do nothing;

insert into categories (slug, name) values
  ('chartering', 'Chartering & Pre-fixture'),
  ('voyage-management', 'Voyage Management'),
  ('da-agency', 'DA & Agency Management'),
  ('crewing-software', 'Crewing & HR'),
  ('planned-maintenance', 'Planned Maintenance (PMS)'),
  ('procurement', 'Procurement & Purchasing'),
  ('erp', 'Maritime ERP & Accounting'),
  ('weather-routing', 'Weather Routing & Performance'),
  ('emissions', 'Emissions & ETS Compliance'),
  ('laytime-claims', 'Laytime & Claims'),
  ('market-data', 'Market Data & Analytics'),
  ('port-operations', 'Port & Terminal Operations'),
  ('document-management', 'Document Management & e-Bills'),
  ('other', 'Other')
on conflict (slug) do nothing;

-- Demo directory entries (placeholders for local development).
insert into companies (slug, name, sector_id, hq_country, hq_city, website, description) values
  ('nordic-bulk-partners', 'Nordic Bulk Partners',
    (select id from sectors where slug = 'dry-bulk'), 'Norway', 'Oslo',
    'https://example.com', 'Demo dry bulk operator used for local development.'),
  ('meridian-chartering', 'Meridian Chartering',
    (select id from sectors where slug = 'shipbroking'), 'United Kingdom', 'London',
    'https://example.com', 'Demo shipbroking house used for local development.'),
  ('portside-agencies', 'Portside Agencies Group',
    (select id from sectors where slug = 'agency'), 'Singapore', 'Singapore',
    'https://example.com', 'Demo port agency network used for local development.'),
  ('harborline-software', 'Harborline Software',
    (select id from sectors where slug = 'maritime-tech'), 'Denmark', 'Copenhagen',
    'https://example.com', 'Demo maritime software vendor used for local development.'),
  ('blue-anchor-events', 'Blue Anchor Events',
    (select id from sectors where slug = 'other'), 'United Arab Emirates', 'Dubai',
    'https://example.com', 'Demo conference organizer used for local development.')
on conflict (slug) do nothing;

insert into software_products (slug, name, vendor_company_id, vendor_name, category_id, description, pricing_model, website) values
  ('harborline-voyage', 'Harborline Voyage',
    (select id from companies where slug = 'harborline-software'), 'Harborline Software',
    (select id from categories where slug = 'voyage-management'),
    'Demo voyage management suite.', 'Per-vessel subscription', 'https://example.com'),
  ('harborline-da', 'Harborline DA Desk',
    (select id from companies where slug = 'harborline-software'), 'Harborline Software',
    (select id from categories where slug = 'da-agency'),
    'Demo DA and agency appointment platform.', 'Per-port-call', 'https://example.com')
on conflict (slug) do nothing;

insert into conferences (slug, name, organizer_company_id, organizer_name, location, sector_id, website, typical_cost_estimate, attendee_categories) values
  ('global-bulk-forum', 'Global Bulk Forum',
    (select id from companies where slug = 'blue-anchor-events'), 'Blue Anchor Events',
    'Dubai, UAE', (select id from sectors where slug = 'dry-bulk'),
    'https://example.com', 'USD 2,500–4,500 incl. travel',
    array['Owners', 'Operators', 'Charterers', 'Brokers']),
  ('maritime-tech-summit', 'Maritime Tech Summit',
    (select id from companies where slug = 'blue-anchor-events'), 'Blue Anchor Events',
    'Rotterdam, Netherlands', (select id from sectors where slug = 'maritime-tech'),
    'https://example.com', 'EUR 1,500–3,000 incl. travel',
    array['Vendors', 'Operators', 'Ship Managers', 'Investors'])
on conflict (slug) do nothing;
