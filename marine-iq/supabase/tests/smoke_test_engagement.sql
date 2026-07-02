-- Marine IQ — engagement & monetization rule tests (migrations 4–5).
-- Run after smoke_test.sql. Rolls back at the end.
\set ON_ERROR_STOP on
begin;

-- Fixture: verified rep (Harborline) + verified professional (Nordic Bulk).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000011', 'rep@harborline.example',
   '{"full_name":"Rep Person","company_name":"Harborline Software","job_title":"COO","linkedin_url":"https://linkedin.com/in/rep","country":"Denmark"}'),
  ('00000000-0000-0000-0000-000000000012', 'pro@nordicbulk.example',
   '{"full_name":"Pro Person","company_name":"Nordic Bulk Partners","job_title":"Ops Manager","linkedin_url":"https://linkedin.com/in/pro","country":"Norway"}');

update users set status = 'verified_company_rep',
  company_id = (select id from companies where slug = 'harborline-software')
  where id = '00000000-0000-0000-0000-000000000011';
update users set status = 'verified_professional',
  company_id = (select id from companies where slug = 'nordic-bulk-partners')
  where id = '00000000-0000-0000-0000-000000000012';

insert into company_representatives (company_id, user_id)
values ((select id from companies where slug = 'harborline-software'),
        '00000000-0000-0000-0000-000000000011');

-- 1. Publishing a review notifies the vendor's reps and marks the AI summary stale.
insert into reviews (author_id, entity_type, software_id, relationship, title, body, overall_rating, status, published_at)
values ('00000000-0000-0000-0000-000000000012', 'software',
        (select id from software_products where slug = 'harborline-voyage'),
        'software_user', 'Solid voyage suite', 'Implementation was smooth and support responds quickly across time zones.', 4, 'published', now());
do $$ begin
  if not exists (select 1 from notifications
                 where user_id = '00000000-0000-0000-0000-000000000011' and type = 'new_review') then
    raise exception 'review notification missing';
  end if;
  if not exists (select 1 from ai_summaries where entity_type = 'software' and is_stale) then
    raise exception 'ai summary not marked stale';
  end if;
  raise notice 'PASS: review publish notifies reps + marks AI summary stale';
end $$;

-- 2. Only a rep of the reviewed company can post the official response.
do $$ begin
  begin
    insert into comments (author_id, review_id, body, is_official_response)
    values ('00000000-0000-0000-0000-000000000012',
            (select id from reviews limit 1), 'Fake official response', true);
    raise exception 'FAIL: non-rep posted official response';
  exception when others then
    if sqlerrm not like '%MARINE_IQ_OFFICIAL%' then raise; end if;
    raise notice 'PASS: official responses restricted to company reps';
  end;
end $$;

-- 3. A real rep can post exactly one official response; it notifies the author.
insert into comments (author_id, review_id, body, is_official_response)
values ('00000000-0000-0000-0000-000000000011',
        (select id from reviews limit 1),
        'Thank you for the review — we have expanded APAC support coverage.', true);
do $$ begin
  if not (select is_company_rep from comments where is_official_response limit 1) then
    raise exception 'official response not labeled as company rep';
  end if;
  if not exists (select 1 from notifications
                 where user_id = '00000000-0000-0000-0000-000000000012' and type = 'official_response') then
    raise exception 'author not notified of official response';
  end if;
  begin
    insert into comments (author_id, review_id, body, is_official_response)
    values ('00000000-0000-0000-0000-000000000011',
            (select id from reviews limit 1), 'Second official response', true);
    raise exception 'FAIL: second official response allowed';
  exception when unique_violation then
    raise notice 'PASS: one official response per review, labeled, author notified';
  end;
end $$;

-- 4. Leads notify company reps.
insert into leads (company_id, lead_type, from_user_id, name, email, message)
values ((select id from companies where slug = 'harborline-software'),
        'request_demo', '00000000-0000-0000-0000-000000000012',
        'Pro Person', 'pro@nordicbulk.example', 'We want a demo for 12 vessels.');
do $$ begin
  if not exists (select 1 from notifications
                 where user_id = '00000000-0000-0000-0000-000000000011' and type = 'new_lead') then
    raise exception 'lead notification missing';
  end if;
  raise notice 'PASS: leads notify company representatives';
end $$;

-- 5. Endorsements and helpful votes notify recipients.
insert into endorsements (endorser_id, endorsed_id, specialty)
values ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000012', 'Dry bulk operations');
insert into votes (user_id, target_type, target_id)
values ('00000000-0000-0000-0000-000000000011', 'review', (select id from reviews limit 1));
do $$ begin
  if not exists (select 1 from notifications where type = 'new_endorsement') then
    raise exception 'endorsement notification missing';
  end if;
  if not exists (select 1 from notifications where type = 'helpful_vote') then
    raise exception 'helpful vote notification missing';
  end if;
  raise notice 'PASS: endorsements and helpful votes notify recipients';
end $$;

-- 6. Ad spend accrues per event and the campaign pauses at budget exhaustion.
insert into ad_accounts (id, owner_user_id, billing_email)
values ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-000000000011', 'ads@harborline.example');
insert into ad_campaigns (id, account_id, name, campaign_type, destination_url, budget_total, cpm, cpc, status)
values ('00000000-0000-0000-0000-00000000ca01', '00000000-0000-0000-0000-00000000aa01',
        'Voyage suite launch', 'sidebar_banner', 'https://example.com', 4.00, 5.00, 1.50, 'active');

insert into ad_events (campaign_id, event_type) select '00000000-0000-0000-0000-00000000ca01', 'click' from generate_series(1, 2);
do $$ begin
  if (select status from ad_campaigns where id = '00000000-0000-0000-0000-00000000ca01') <> 'active' then
    raise exception 'campaign paused too early';
  end if;
end $$;
insert into ad_events (campaign_id, event_type) values ('00000000-0000-0000-0000-00000000ca01', 'click');
do $$ begin
  if (select status from ad_campaigns where id = '00000000-0000-0000-0000-00000000ca01') <> 'budget_exhausted' then
    raise exception 'campaign did not pause at budget exhaustion (spend=%)',
      (select spend from ad_campaigns where id = '00000000-0000-0000-0000-00000000ca01');
  end if;
  if (select impressions + clicks from ad_campaign_stats where campaign_id = '00000000-0000-0000-0000-00000000ca01') <> 3 then
    raise exception 'campaign stats wrong';
  end if;
  raise notice 'PASS: ad spend accrues and campaign auto-pauses at budget exhaustion';
end $$;

-- 7. Featured job placement cannot be self-granted.
do $$ begin
  begin
    set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
    insert into job_posts (company_id, posted_by, title, description, is_featured)
    values ((select id from companies where slug = 'harborline-software'),
            '00000000-0000-0000-0000-000000000011',
            'Senior Implementation Consultant', 'Own onboarding for new fleets.', true);
    raise exception 'FAIL: rep self-featured a job post';
  exception when others then
    if sqlerrm not like '%MARINE_IQ_JOBS%' then raise; end if;
    raise notice 'PASS: featured job placement requires purchase (admin-set)';
  end;
end $$;

rollback;
\echo === ALL ENGAGEMENT/MONETIZATION TESTS PASSED ===
