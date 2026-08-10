"""SQLite DDL for the items domain."""

DDL = """
-- Soft-template categories for trackable items (global; ownership is via workset).
CREATE TABLE IF NOT EXISTS item_categories (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    slug                        TEXT DEFAULT NULL,
    sort_order                  INTEGER NOT NULL DEFAULT 0,
    color                       TEXT DEFAULT NULL,
    emoji                       TEXT DEFAULT NULL,
    field_schema                TEXT NOT NULL DEFAULT '[]',
    default_remind_before_days  INTEGER DEFAULT NULL,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_categories_slug
    ON item_categories(slug)
    WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_item_categories_sort
    ON item_categories(sort_order ASC, name ASC);

-- Trackable items (inventory / expiry). Core flat columns + soft attributes_json.
CREATE TABLE IF NOT EXISTS items (
    id                   TEXT PRIMARY KEY,
    title                TEXT NOT NULL,
    category_id          TEXT DEFAULT NULL
                         REFERENCES item_categories(id) ON DELETE SET NULL,
    workset_id           TEXT NOT NULL DEFAULT '__user__'
                         REFERENCES worksets(id),
    expires_at           TEXT DEFAULT NULL,
    remind_before_days   INTEGER DEFAULT NULL,
    notes                TEXT NOT NULL DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'archived')),
    emoji                TEXT DEFAULT NULL,
    quantity             REAL DEFAULT NULL,
    unit                 TEXT DEFAULT NULL,
    attributes_json      TEXT NOT NULL DEFAULT '{}',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_workset_id
    ON items(workset_id);
CREATE INDEX IF NOT EXISTS idx_items_category_id
    ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_status_expires
    ON items(status, expires_at ASC);
CREATE INDEX IF NOT EXISTS idx_items_updated_at_asc
    ON items(updated_at ASC);

INSERT OR IGNORE INTO item_categories (
    id, name, slug, sort_order, color, emoji, field_schema, default_remind_before_days, created_at, updated_at
) VALUES
(
    'seed_passport_docs', '證件', 'passport_docs', 10, '#3B82F6', '🪪',
    '[{"key":"id_number","label":"證件號碼"},{"key":"issuer","label":"簽發機關"}]',
    90, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_food', '食物', 'food', 20, '#22C55E', '🍎',
    '[{"key":"brand","label":"品牌"},{"key":"storage","label":"保存方式"}]',
    3, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_credit_card', '信用卡', 'credit_card', 30, '#F59E0B', '💳',
    '[{"key":"issuer","label":"發卡行"},{"key":"last_four","label":"末四碼"}]',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_warranty', '保固', 'warranty', 40, '#8B5CF6', '🛡️',
    '[{"key":"serial","label":"序號"},{"key":"vendor","label":"廠商"}]',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_contract', '合約', 'contract', 50, '#EC4899', '📄',
    '[{"key":"counterparty","label":"相對方"},{"key":"ref_number","label":"合約編號"}]',
    60, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_household', '家庭用品', 'household', 55, '#14B8A6', '🏠',
    '[{"key":"brand","label":"品牌"},{"key":"location","label":"存放位置"}]',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_medicine', '藥品', 'medicine', 60, '#EF4444', '💊',
    '[{"key":"dosage","label":"用法"},{"key":"pharmacy","label":"藥局"}]',
    7, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_subscription', '訂閱', 'subscription', 65, '#06B6D4', '🔁',
    '[{"key":"provider","label":"服務商"},{"key":"plan","label":"方案"}]',
    7, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_membership', '會員', 'membership', 70, '#A855F7', '🎫',
    '[{"key":"provider","label":"機構"},{"key":"member_id","label":"會員編號"}]',
    14, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_insurance', '保險', 'insurance', 75, '#0EA5E9', '☂️',
    '[{"key":"insurer","label":"保險公司"},{"key":"policy_number","label":"保單號碼"}]',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_vehicle', '車輛', 'vehicle', 80, '#F97316', '🚗',
    '[{"key":"plate","label":"車牌"},{"key":"vin","label":"車架號碼"}]',
    30, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
),
(
    'seed_other', '其他', 'other', 90, '#64748B', '📦',
    '[]',
    NULL, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z'
);
"""
