-- The lab world. A deliberately un-indexed authors/books schema at enough scale
-- that a sequential scan and an index scan look visibly different in the plan.
-- The Workbench's whole point is that YOU add the index and watch the plan change,
-- so we ship only the primary keys and leave the interesting indexes to you.

CREATE TABLE authors (
    id         serial PRIMARY KEY,
    name       text NOT NULL,
    country    text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE books (
    id             serial PRIMARY KEY,
    author_id      integer NOT NULL REFERENCES authors (id),
    title          text NOT NULL,
    genre          text NOT NULL,
    published_year integer NOT NULL,
    price          numeric(6, 2) NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- 5,000 authors.
INSERT INTO authors (name, country)
SELECT
    'Author ' || g,
    (ARRAY['US', 'UK', 'FR', 'DE', 'JP', 'BR', 'NG', 'IN'])[1 + (g % 8)]
FROM generate_series(1, 5000) AS g;

-- 500,000 books spread across the authors (~100 each). generate_series makes this
-- a couple of seconds even at this size.
INSERT INTO books (author_id, title, genre, published_year, price)
SELECT
    1 + (g % 5000),
    'Book ' || g,
    (ARRAY['fiction', 'history', 'science', 'poetry', 'tech'])[1 + (g % 5)],
    1950 + (g % 75),
    (5 + (g % 40))::numeric(6, 2)
FROM generate_series(1, 500000) AS g;

ANALYZE;

-- A server-side guard so a runaway query in the Workbench cannot hang the lab.
-- The app also sets this per connection, but pinning it on the role is defense
-- in depth for anything that connects.
ALTER ROLE devbox_lab SET statement_timeout = '5000ms';
