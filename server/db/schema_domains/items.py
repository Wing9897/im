"""SQLite DDL for the items domain."""

from server.db.schema_domains.vocabulary import ITEM_STATUS_CHECK_SQL

DDL = f"""
-- Soft-template categories for trackable items (global; ownership is via workset).
CREATE TABLE IF NOT EXISTS item_categories (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    slug                        TEXT DEFAULT NULL,
    sort_order                  INTEGER NOT NULL DEFAULT 0,
    color                       TEXT DEFAULT NULL,
    emoji                       TEXT DEFAULT NULL,
    default_remind_before_days  INTEGER DEFAULT NULL,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_categories_slug
    ON item_categories(slug)
    WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_categories_sort
    ON item_categories(sort_order ASC, name ASC);

-- Trackable items (inventory). Core flat columns; free-form details in notes.
-- Expiry / remind-before are derived on read from the primary linked
-- user_events row with kind=expires (no denormalized cache columns).
CREATE TABLE IF NOT EXISTS items (
    id                   TEXT PRIMARY KEY,
    title                TEXT NOT NULL,
    category_id          TEXT DEFAULT NULL
                         REFERENCES item_categories(id) ON DELETE SET NULL,
    workset_id           TEXT NOT NULL DEFAULT '__general__'
                         REFERENCES worksets(id),
    notes                TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'active'
                         {ITEM_STATUS_CHECK_SQL},
    emoji                TEXT DEFAULT NULL,
    quantity             REAL DEFAULT NULL,
    unit                 TEXT DEFAULT NULL,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_workset_id
    ON items(workset_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id
    ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_status
    ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_updated_at_asc
    ON items(updated_at ASC);

INSERT OR IGNORE INTO item_categories (
    id, name, slug, sort_order, color, emoji, default_remind_before_days, created_at, updated_at
) VALUES
(
    'seed_passport_docs', '證件', 'passport_docs', 10, '#3B82F6', '🪪',
    90, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_food', '食物', 'food', 20, '#22C55E', '🍎',
    3, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_credit_card', '信用卡', 'credit_card', 30, '#F59E0B', '💳',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_warranty', '保固', 'warranty', 40, '#8B5CF6', '🛡️',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_contract', '合約', 'contract', 50, '#EC4899', '📄',
    60, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_household', '家庭用品', 'household', 55, '#14B8A6', '🏠',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_medicine', '藥品', 'medicine', 60, '#EF4444', '💊',
    7, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_subscription', '訂閱', 'subscription', 65, '#06B6D4', '🔁',
    7, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_membership', '會員', 'membership', 70, '#A855F7', '🎫',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_insurance', '保險', 'insurance', 75, '#0EA5E9', '☂️',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_vehicle', '車輛', 'vehicle', 80, '#F97316', '🚗',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_other', '其他', 'other', 90, '#64748B', '📦',
    NULL, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
);
"""
