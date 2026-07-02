-- Functional smoke test of Marine IQ business rules.
\set ON_ERROR_STOP on
begin;

-- 1. Signup trigger creates the private account row.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'ola@nordicbulk.example',
   '{"full_name":"Ola Nordmann","company_name":"Nordic Bulk Partners","job_title":"Chartering Manager","linkedin_url":"https://linkedin.com/in/ola","country":"Norway"}'),
  ('00000000-0000-0000-0000-000000000002', 'sam@harborline.example',
   '{"full_name":"Sam Vendor","company_name":"Harborline Software","job_title":"Sales Director","linkedin_url":"https://linkedin.com/in/sam","country":"Denmark"}');
do $$ begin
  if (select count(*) from users) <> 2 then raise exception 'signup trigger failed'; end if;
  raise notice 'PASS: signup trigger creates account rows';
end $$;

-- 2. Unverified users cannot review (trigger gate).
do $$ begin
  begin
    insert into reviews (author_id, entity_type, company_id, relationship, title, body, overall_rating)
    values ('00000000-0000-0000-0000-000000000001', 'company',
            (select id from companies where slug = 'meridian-chartering'),
            'customer', 'Great brokers', 'Long body text for the review goes here.', 5);
    raise exception 'FAIL: unverified user was allowed to review';
  exception when others then
    if sqlerrm not like '%MARINE_IQ_NOT_VERIFIED%' then raise; end if;
    raise notice 'PASS: unverified users blocked from reviewing';
  end;
end $$;

-- 3. Verification creates the public profile + reputation row.
update users set status = 'verified_professional',
  company_id = (select id from companies where slug = 'nordic-bulk-partners')
  where id = '00000000-0000-0000-0000-000000000001';
update users set status = 'verified_software_vendor',
  company_id = (select id from companies where slug = 'harborline-software')
  where id = '00000000-0000-0000-0000-000000000002';
do $$ begin
  if (select count(*) from professional_profiles) <> 2 then raise exception 'profile auto-create failed'; end if;
  if (select count(*) from reputation_scores) <> 2 then raise exception 'reputation auto-create failed'; end if;
  if (select count(*) from audit_logs where action = 'user_status_change') <> 2 then raise exception 'audit failed'; end if;
  raise notice 'PASS: verification auto-creates profile, reputation, audit entries';
end $$;

-- 4. Conflict of interest: cannot rate own employer (by company_id).
do $$ begin
  begin
    insert into reviews (author_id, entity_type, company_id, relationship, title, body, overall_rating)
    values ('00000000-0000-0000-0000-000000000001', 'company',
            (select id from companies where slug = 'nordic-bulk-partners'),
            'customer', 'We are great', 'Definitely unbiased review of my own employer.', 5);
    raise exception 'FAIL: own-employer rating allowed';
  exception when others then
    if sqlerrm not like '%MARINE_IQ_CONFLICT%' then raise; end if;
    raise notice 'PASS: cannot rate own employer';
  end;
end $$;

-- 5. Conflict of interest: vendor cannot rate own software.
do $$ begin
  begin
    insert into reviews (author_id, entity_type, software_id, relationship, title, body, overall_rating)
    values ('00000000-0000-0000-0000-000000000002', 'software',
            (select id from software_products where slug = 'harborline-voyage'),
            'software_user', 'Best software', 'Rating the software my company sells, surely fine.', 5);
    raise exception 'FAIL: own-software rating allowed';
  exception when others then
    if sqlerrm not like '%MARINE_IQ_CONFLICT%' then raise; end if;
    raise notice 'PASS: vendor cannot rate own software';
  end;
end $$;

-- 6. Current employees cannot rate.
do $$ begin
  begin
    insert into reviews (author_id, entity_type, company_id, relationship, title, body, overall_rating)
    values ('00000000-0000-0000-0000-000000000001', 'company',
            (select id from companies where slug = 'meridian-chartering'),
            'current_employee', 'Insider view', 'Body long enough to pass validation rules here.', 4);
    raise exception 'FAIL: current employee rating allowed';
  exception when others then
    if sqlerrm not like '%reviews_no_current_employee_rating%' and sqlerrm not like '%MARINE_IQ_CONFLICT%' then raise; end if;
    raise notice 'PASS: current employees cannot rate';
  end;
end $$;

-- 7. Legitimate review publishes with correct relationship weight.
insert into reviews (author_id, entity_type, company_id, relationship, title, body, overall_rating, status, published_at)
values ('00000000-0000-0000-0000-000000000001', 'company',
        (select id from companies where slug = 'meridian-chartering'),
        'customer', 'Professional counterparty', 'Fixed several cargoes through them; clean recaps, prompt commission handling.', 4, 'published', now());
insert into review_scores (review_id, category, score)
select id, 'payment_reliability', 5 from reviews where title = 'Professional counterparty';
insert into review_scores (review_id, category, score)
select id, 'communication', 4 from reviews where title = 'Professional counterparty';
do $$ begin
  if (select weight from reviews where title = 'Professional counterparty') <> 1.00 then
    raise exception 'weight wrong';
  end if;
  if (select weighted_score from entity_category_scores where category = 'payment_reliability') <> 5.00 then
    raise exception 'category view wrong';
  end if;
  if (select overall_score from entity_overall_scores limit 1) <> 4.00 then
    raise exception 'overall view wrong';
  end if;
  raise notice 'PASS: weighted scoring views compute correctly';
end $$;

-- 8. Duplicate review by same author on same company is rejected.
do $$ begin
  begin
    insert into reviews (author_id, entity_type, company_id, relationship, title, body, overall_rating)
    values ('00000000-0000-0000-0000-000000000001', 'company',
            (select id from companies where slug = 'meridian-chartering'),
            'customer', 'Another one', 'Trying to double-dip on the same company review.', 5);
    raise exception 'FAIL: duplicate review allowed';
  exception when unique_violation then
    raise notice 'PASS: duplicate reviews blocked';
  end;
end $$;

-- 9. Company-rep comments are auto-labeled.
insert into comments (author_id, company_id, body)
values ('00000000-0000-0000-0000-000000000002',
        (select id from companies where slug = 'harborline-software'),
        'Official note from the vendor about our support process.');
do $$ begin
  if not (select is_company_rep from comments limit 1) then
    raise exception 'rep labeling failed';
  end if;
  raise notice 'PASS: company representative comments auto-labeled';
end $$;

-- 10. Trust signals cannot be published without admin.
insert into trust_signals (company_id, signal_type, description, created_by)
values ((select id from companies where slug = 'meridian-chartering'),
        'reported_payment_concern', 'Commission payment delayed 90+ days on two fixtures.',
        '00000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    update trust_signals set status = 'published';
    raise exception 'FAIL: non-admin published a trust signal';
  exception when others then
    if sqlerrm not like '%MARINE_IQ_ADMIN_REQUIRED%' then raise; end if;
    raise notice 'PASS: trust signal publication requires admin';
  end;
end $$;

-- 11. Trust index view shows the company with confidence labels.
do $$ declare r record; begin
  select * into r from company_trust_index where slug = 'meridian-chartering';
  if r.reputation_confidence <> 'Emerging' or r.risk_label <> 'No Verified Concerns' then
    raise exception 'trust index labels wrong: % / %', r.reputation_confidence, r.risk_label;
  end if;
  raise notice 'PASS: trust index confidence + risk labels correct';
end $$;

-- 12. profile_stats aggregates.
do $$ begin
  if (select reviews_submitted from profile_stats where user_id = '00000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'profile stats wrong';
  end if;
  raise notice 'PASS: profile stats aggregate correctly';
end $$;

rollback;
\echo === ALL SMOKE TESTS PASSED ===
