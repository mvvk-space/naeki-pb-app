-- Live dish stock seed — one counter per (menu_item.name, branch.name).
-- Re-runnable: applying this file IS the restock (qty resets to seed_qty).
--   psql "$(cat ~/.config/neon/naeki-sushi.dsn)" -f db/stock-data.sql
-- Names must match menu_item.name / branch.name EXACTLY (they are the join
-- keys the client resolves badges and reserve calls against).
begin;

insert into dish_stock (dish, branch, qty, seed_qty) values
  -- Naeki Sushi @ BTS Siam (flagship counter)
  ('Salmon Nigiri',         'Naeki Sushi @ BTS Siam', 6, 6),
  ('Fatty Salmon Nigiri',   'Naeki Sushi @ BTS Siam', 4, 4),
  ('Salmon & Ikura Don',    'Naeki Sushi @ BTS Siam', 3, 3),
  ('Aburi Salmon Roll',     'Naeki Sushi @ BTS Siam', 5, 5),
  ('Salmon Sashimi',        'Naeki Sushi @ BTS Siam', 4, 4),
  ('Ikura Nigiri',          'Naeki Sushi @ BTS Siam', 5, 5),
  -- Naeki Go! @ BTS Asok (kiosk)
  ('Roasted Salmon',        'Naeki Go! @ BTS Asok',   8, 8),
  ('Salmon Mayo',           'Naeki Go! @ BTS Asok',   7, 7),
  ('Tuna Mayo Onigiri',     'Naeki Go! @ BTS Asok',   10, 10),
  ('Mentaiko Onigiri',      'Naeki Go! @ BTS Asok',   6, 6),
  ('Iced Matcha',           'Naeki Go! @ BTS Asok',   9, 9),
  ('Matcha Latte',          'Naeki Go! @ BTS Asok',   9, 9)
on conflict (dish, branch) do update
  set qty = excluded.qty, seed_qty = excluded.seed_qty, updated = now();

commit;