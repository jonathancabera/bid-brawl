CREATE TABLE users (
    user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    stripe_account_id TEXT,
    stripe_customer_id TEXT
);

CREATE TABLE auctions (
    auction_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seller_id INT NOT NULL REFERENCES users(user_id),
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_image TEXT,
    starting_price NUMERIC(12, 2) NOT NULL CHECK (starting_price >= 0),
    reserve_price NUMERIC(12, 2) CHECK (reserve_price >= 0),
    current_price NUMERIC(12, 2) CHECK(current_price >= 0),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'closed')),
    winner_id INT REFERENCES users(user_id)
);

CREATE TABLE bids (
    bid_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auction_id INT NOT NULL REFERENCES auctions(auction_id),
    bidder_id INT NOT NULL REFERENCES users(user_id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    payment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auction_id INT NOT NULL REFERENCES auctions(auction_id),
    buyer_id INT NOT NULL REFERENCES users(user_id),
    seller_id INT NOT NULL REFERENCES users(user_id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'succeeded', 'failed')),
    stripe_payment_intent_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_auction_amount ON bids (auction_id, amount DESC);