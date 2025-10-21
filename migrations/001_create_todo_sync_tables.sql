-- ChittyOS Omnidirectional Todo Sync - Database Schema
-- Version: 1.0.0
-- Created: 2025-10-10
-- Description: Creates tables, indexes, and views for cross-platform todo synchronization

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For similarity search (duplicate detection)

-- =============================================================================
-- TABLE: todos (Source of Truth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS chittyschema.todos (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id VARCHAR(255) UNIQUE NOT NULL,  -- From id.chitty.cc

    -- Ownership
    user_id VARCHAR(255) NOT NULL,
    created_by_platform VARCHAR(50) NOT NULL,  -- 'claude_code', 'chatgpt', 'cursor', etc.
    created_by_session VARCHAR(255),  -- Session ID if applicable

    -- Content
    content TEXT NOT NULL,
    active_form TEXT,  -- Present continuous form (for Claude Code TodoWrite)
    description TEXT,

    -- Status & Priority
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',

    -- Categorization
    type VARCHAR(50),  -- 'deployment', 'decision', 'action', 'investigation'
    tags JSONB DEFAULT '[]',
    project VARCHAR(255),

    -- Relationships
    parent_id UUID REFERENCES chittyschema.todos(id) ON DELETE SET NULL,
    related_todos UUID[],

    -- CRDT Metadata (for conflict resolution)
    vector_clock JSONB NOT NULL DEFAULT '{}',  -- {'claude_code': 5, 'chatgpt': 3}
    last_modified_by VARCHAR(255) NOT NULL,    -- Platform:DeviceID
    revision INTEGER NOT NULL DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,

    -- Sync State
    sync_version INTEGER NOT NULL DEFAULT 1,
    synced_platforms JSONB DEFAULT '{}',  -- {'claude_code': '2025-10-10T12:00:00Z'}

    -- Soft Delete
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'archived', 'deleted')),
    CONSTRAINT priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON chittyschema.todos(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_status ON chittyschema.todos(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_created_by_platform ON chittyschema.todos(created_by_platform);
CREATE INDEX IF NOT EXISTS idx_todos_updated_at ON chittyschema.todos(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_todos_vector_clock ON chittyschema.todos USING gin(vector_clock);
CREATE INDEX IF NOT EXISTS idx_todos_tags ON chittyschema.todos USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_todos_project ON chittyschema.todos(project) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON chittyschema.todos(parent_id);

-- GIN index for full-text search on content
CREATE INDEX IF NOT EXISTS idx_todos_content_trgm ON chittyschema.todos USING gin(content gin_trgm_ops);

COMMENT ON TABLE chittyschema.todos IS 'Source of truth for all todos across platforms';
COMMENT ON COLUMN chittyschema.todos.vector_clock IS 'CRDT vector clock for conflict resolution';
COMMENT ON COLUMN chittyschema.todos.sync_version IS 'Incremented on each change for optimistic locking';

-- =============================================================================
-- TABLE: todo_revisions (Full History)
-- =============================================================================
CREATE TABLE IF NOT EXISTS chittyschema.todo_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    todo_id UUID NOT NULL REFERENCES chittyschema.todos(id) ON DELETE CASCADE,

    -- Snapshot of todo at this revision
    snapshot JSONB NOT NULL,

    -- Change tracking
    changed_fields TEXT[],
    change_type VARCHAR(20) NOT NULL,  -- 'create', 'update', 'delete'
    changed_by VARCHAR(255) NOT NULL,  -- Platform:DeviceID

    -- CRDT
    vector_clock JSONB NOT NULL,
    revision INTEGER NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT change_type_check CHECK (change_type IN ('create', 'update', 'delete'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_todo_id ON chittyschema.todo_revisions(todo_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_created_at ON chittyschema.todo_revisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_change_type ON chittyschema.todo_revisions(change_type);

COMMENT ON TABLE chittyschema.todo_revisions IS 'Full audit trail of all todo changes';

-- =============================================================================
-- TABLE: todo_subscriptions (WebSocket Connections)
-- =============================================================================
CREATE TABLE IF NOT EXISTS chittyschema.todo_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,

    -- WebSocket connection
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(50) NOT NULL,
    device_id VARCHAR(255) NOT NULL,

    -- Subscription filters
    filter_type VARCHAR(20) DEFAULT 'all',  -- 'all', 'project', 'status'
    filter_value TEXT,

    -- Connection state
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,

    -- Metadata
    user_agent TEXT,
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON chittyschema.todo_subscriptions(user_id) WHERE disconnected_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_connection_id ON chittyschema.todo_subscriptions(connection_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_platform ON chittyschema.todo_subscriptions(platform);
CREATE INDEX IF NOT EXISTS idx_subscriptions_last_ping ON chittyschema.todo_subscriptions(last_ping_at) WHERE disconnected_at IS NULL;

COMMENT ON TABLE chittyschema.todo_subscriptions IS 'Active WebSocket subscriptions for real-time sync';

-- =============================================================================
-- TABLE: todo_conflicts (Unresolved Conflicts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS chittyschema.todo_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    todo_id UUID NOT NULL REFERENCES chittyschema.todos(id) ON DELETE CASCADE,

    -- Conflicting versions
    version_a JSONB NOT NULL,
    version_b JSONB NOT NULL,

    -- Conflict metadata
    conflict_type VARCHAR(50) NOT NULL,
    conflicting_fields TEXT[],

    -- Resolution
    resolution_strategy VARCHAR(50),  -- 'auto_merge', 'manual', 'last_write_wins'
    resolved_version JSONB,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255),

    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT conflict_type_check CHECK (conflict_type IN ('concurrent_edit', 'content_divergence', 'status_conflict', 'deletion_conflict'))
);

CREATE INDEX IF NOT EXISTS idx_conflicts_todo_id ON chittyschema.todo_conflicts(todo_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON chittyschema.todo_conflicts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conflicts_detected_at ON chittyschema.todo_conflicts(detected_at DESC);

COMMENT ON TABLE chittyschema.todo_conflicts IS 'Tracks conflicts that require resolution';

-- =============================================================================
-- TABLE: todo_sync_log (Audit Trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS chittyschema.todo_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Sync event
    user_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    device_id VARCHAR(255) NOT NULL,

    -- Operation
    operation VARCHAR(20) NOT NULL,
    todo_ids UUID[],

    -- Sync stats
    todos_synced INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,

    -- Performance
    latency_ms INTEGER,

    -- Metadata
    request_id VARCHAR(255),
    user_agent TEXT,

    -- Timestamps
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT operation_check CHECK (operation IN ('create', 'update', 'delete', 'sync', 'batch_sync'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON chittyschema.todo_sync_log(user_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_synced_at ON chittyschema.todo_sync_log(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_platform ON chittyschema.todo_sync_log(platform, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_operation ON chittyschema.todo_sync_log(operation);

COMMENT ON TABLE chittyschema.todo_sync_log IS 'Audit log of all sync operations';

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: active_todos_by_platform
CREATE OR REPLACE VIEW chittyschema.active_todos_by_platform AS
SELECT
    user_id,
    created_by_platform,
    status,
    COUNT(*) as todo_count,
    MAX(updated_at) as last_updated
FROM chittyschema.todos
WHERE deleted_at IS NULL
  AND status != 'archived'
GROUP BY user_id, created_by_platform, status;

COMMENT ON VIEW chittyschema.active_todos_by_platform IS 'Summary of active todos by platform and status';

-- View: duplicate_detection
CREATE OR REPLACE VIEW chittyschema.duplicate_detection AS
SELECT
    user_id,
    LOWER(TRIM(content)) as normalized_content,
    status,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id) as todo_ids,
    ARRAY_AGG(created_by_platform) as platforms,
    MIN(created_at) as first_created,
    MAX(updated_at) as last_updated
FROM chittyschema.todos
WHERE deleted_at IS NULL
GROUP BY user_id, LOWER(TRIM(content)), status
HAVING COUNT(*) > 1;

COMMENT ON VIEW chittyschema.duplicate_detection IS 'Identifies potential duplicate todos';

-- View: sync_health_metrics
CREATE OR REPLACE VIEW chittyschema.sync_health_metrics AS
SELECT
    DATE_TRUNC('hour', synced_at) as hour,
    platform,
    COUNT(*) as sync_events,
    SUM(todos_synced) as total_todos_synced,
    SUM(conflicts_detected) as total_conflicts,
    SUM(errors) as total_errors,
    AVG(latency_ms) as avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms
FROM chittyschema.todo_sync_log
GROUP BY DATE_TRUNC('hour', synced_at), platform;

COMMENT ON VIEW chittyschema.sync_health_metrics IS 'Performance metrics for sync operations';

-- View: user_todo_stats
CREATE OR REPLACE VIEW chittyschema.user_todo_stats AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE status = 'pending' AND deleted_at IS NULL) as pending_count,
    COUNT(*) FILTER (WHERE status = 'in_progress' AND deleted_at IS NULL) as in_progress_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND deleted_at IS NULL) as completed_count,
    COUNT(*) FILTER (WHERE status = 'archived' AND deleted_at IS NULL) as archived_count,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_active,
    MAX(updated_at) as last_activity,
    MIN(created_at) as first_todo_created
FROM chittyschema.todos
GROUP BY user_id;

COMMENT ON VIEW chittyschema.user_todo_stats IS 'Per-user todo statistics';

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function: update_todo_timestamp
CREATE OR REPLACE FUNCTION chittyschema.update_todo_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.sync_version = OLD.sync_version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update timestamp on todo update
DROP TRIGGER IF EXISTS trigger_update_todo_timestamp ON chittyschema.todos;
CREATE TRIGGER trigger_update_todo_timestamp
    BEFORE UPDATE ON chittyschema.todos
    FOR EACH ROW
    EXECUTE FUNCTION chittyschema.update_todo_timestamp();

-- Function: create_todo_revision
CREATE OR REPLACE FUNCTION chittyschema.create_todo_revision()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields TEXT[];
    change_type VARCHAR(20);
BEGIN
    -- Determine change type
    IF (TG_OP = 'INSERT') THEN
        change_type := 'create';
        changed_fields := ARRAY['all'];
    ELSIF (TG_OP = 'UPDATE') THEN
        change_type := 'update';
        changed_fields := ARRAY(
            SELECT key
            FROM jsonb_each(to_jsonb(NEW)) new_json
            JOIN jsonb_each(to_jsonb(OLD)) old_json ON new_json.key = old_json.key
            WHERE new_json.value IS DISTINCT FROM old_json.value
        );
    ELSIF (TG_OP = 'DELETE') THEN
        change_type := 'delete';
        changed_fields := ARRAY['all'];
    END IF;

    -- Insert revision
    INSERT INTO chittyschema.todo_revisions (
        todo_id,
        snapshot,
        changed_fields,
        change_type,
        changed_by,
        vector_clock,
        revision
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        to_jsonb(COALESCE(NEW, OLD)),
        changed_fields,
        change_type,
        COALESCE(NEW.last_modified_by, OLD.last_modified_by),
        COALESCE(NEW.vector_clock, OLD.vector_clock),
        COALESCE(NEW.revision, OLD.revision)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Create revision on todo change
DROP TRIGGER IF EXISTS trigger_create_todo_revision ON chittyschema.todos;
CREATE TRIGGER trigger_create_todo_revision
    AFTER INSERT OR UPDATE OR DELETE ON chittyschema.todos
    FOR EACH ROW
    EXECUTE FUNCTION chittyschema.create_todo_revision();

-- Function: cleanup_stale_subscriptions
CREATE OR REPLACE FUNCTION chittyschema.cleanup_stale_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark subscriptions as disconnected if no ping in last 5 minutes
    UPDATE chittyschema.todo_subscriptions
    SET disconnected_at = NOW()
    WHERE disconnected_at IS NULL
      AND last_ping_at < NOW() - INTERVAL '5 minutes';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Delete old disconnected subscriptions (older than 24 hours)
    DELETE FROM chittyschema.todo_subscriptions
    WHERE disconnected_at IS NOT NULL
      AND disconnected_at < NOW() - INTERVAL '24 hours';

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION chittyschema.cleanup_stale_subscriptions IS 'Cleanup stale WebSocket subscriptions (run via cron)';

-- Function: get_similar_todos (for duplicate detection)
CREATE OR REPLACE FUNCTION chittyschema.get_similar_todos(
    p_user_id VARCHAR,
    p_content TEXT,
    p_similarity_threshold FLOAT DEFAULT 0.8
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    status VARCHAR,
    created_by_platform VARCHAR,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.content,
        t.status,
        t.created_by_platform,
        similarity(LOWER(TRIM(t.content)), LOWER(TRIM(p_content))) AS similarity_score
    FROM chittyschema.todos t
    WHERE t.user_id = p_user_id
      AND t.deleted_at IS NULL
      AND t.status IN ('pending', 'in_progress')
      AND similarity(LOWER(TRIM(t.content)), LOWER(TRIM(p_content))) > p_similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION chittyschema.get_similar_todos IS 'Find similar todos for duplicate detection';

-- =============================================================================
-- ROW-LEVEL SECURITY (Optional - enable if multi-tenant)
-- =============================================================================

-- Enable RLS on todos table
-- ALTER TABLE chittyschema.todos ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own todos
-- CREATE POLICY todos_user_isolation ON chittyschema.todos
--   FOR ALL
--   USING (user_id = current_setting('app.user_id', true)::VARCHAR);

-- =============================================================================
-- GRANTS (Adjust based on your user/role setup)
-- =============================================================================

-- Grant permissions to application user (replace 'chittymcp_user' with your user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON chittyschema.todos TO chittymcp_user;
-- GRANT SELECT, INSERT ON chittyschema.todo_revisions TO chittymcp_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON chittyschema.todo_subscriptions TO chittymcp_user;
-- GRANT SELECT, INSERT, UPDATE ON chittyschema.todo_conflicts TO chittymcp_user;
-- GRANT SELECT, INSERT ON chittyschema.todo_sync_log TO chittymcp_user;

-- =============================================================================
-- INITIAL DATA (Optional)
-- =============================================================================

-- Insert sample todo for testing (remove in production)
-- INSERT INTO chittyschema.todos (
--     chitty_id, user_id, content, status, priority, type,
--     created_by_platform, vector_clock, last_modified_by
-- ) VALUES (
--     'CHITTY_TODO_SAMPLE_001',
--     'user_sample',
--     'Test omnidirectional sync',
--     'pending',
--     'high',
--     'testing',
--     'migration_script',
--     '{"migration": 1}'::jsonb,
--     'migration_script:init'
-- );

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Verify tables created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'chittyschema'
      AND table_name IN ('todos', 'todo_revisions', 'todo_subscriptions', 'todo_conflicts', 'todo_sync_log');

    IF table_count = 5 THEN
        RAISE NOTICE 'Migration successful: All 5 tables created in chittyschema';
    ELSE
        RAISE WARNING 'Migration incomplete: Only % of 5 tables created', table_count;
    END IF;
END $$;
