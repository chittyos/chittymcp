/**
 * ChittyDisputes SQL Handlers
 * Database-direct implementations for dispute management tools.
 * Queries run against public.disputes and public.dispute_events
 * in the shared ChittyLedger Neon PostgreSQL database.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a dispute identifier to a UUID.
 * Accepts either a UUID directly or a ChittyID string.
 */
async function resolveDisputeId(sql, id) {
  if (UUID_PATTERN.test(id)) {
    return id;
  }
  const rows = await sql`
    SELECT id FROM public.disputes WHERE chitty_id = ${id} AND deleted_at IS NULL
  `;
  if (rows.length === 0) {
    throw new Error(`Dispute not found for ChittyID: ${id}`);
  }
  return rows[0].id;
}

/**
 * Mint a ChittyID for a new dispute.
 * Attempts the ChittyID service first, falls back to local generation.
 */
async function mintChittyId() {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    const resp = await fetch('https://id.chitty.cc/api/get-chittyid?for=dispute', {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.components?.sequential) {
        const seq = String(data.components.sequential).padStart(4, '0').slice(-4);
        return `01-C-DSP-${seq}-T-${yymm}-0-X`;
      }
    }
  } catch {
    // Service unavailable — fall through to local generation
  }

  const seq = ((Date.now() % 1679616) >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
  return `01-C-DSP-${seq}-T-${yymm}-0-X`;
}

/**
 * Create a new dispute.
 */
export async function disputeCreate(sql, args) {
  const {
    title,
    dispute_type,
    severity = 'MEDIUM',
    description = null,
    property_address = null,
    property_unit = null,
    parties = [],
    docket_number = null,
    estimated_cost = null,
    response_deadline = null,
    next_action_date = null,
    next_action_description = null,
    source = 'chittymcp',
    tags = [],
    metadata = {}
  } = args;

  if (!title || !dispute_type) {
    throw new Error('title and dispute_type are required');
  }

  const chittyId = await mintChittyId();

  const rows = await sql`
    INSERT INTO public.disputes (
      chitty_id, title, description, dispute_type, severity, domains,
      reported_by, parties, property_address, property_unit,
      docket_number, estimated_cost,
      response_deadline, next_action_date, next_action_description,
      document_refs, source, tags, metadata, created_by
    ) VALUES (
      ${chittyId},
      ${title},
      ${description},
      ${dispute_type}::dispute_type,
      ${severity}::dispute_severity,
      '{}'::text[],
      ${'chittymcp'},
      ${JSON.stringify(parties)}::jsonb,
      ${property_address},
      ${property_unit},
      ${docket_number},
      ${estimated_cost},
      ${response_deadline},
      ${next_action_date},
      ${next_action_description},
      '[]'::jsonb,
      ${source},
      ${tags},
      ${JSON.stringify(metadata)}::jsonb,
      ${'chittymcp'}
    )
    RETURNING *
  `;

  const dispute = rows[0];

  // Log creation event
  await sql`
    INSERT INTO public.dispute_events (dispute_id, event_type, summary, actor)
    VALUES (${dispute.id}, 'note', ${`Dispute created: ${title}`}, 'chittymcp')
  `;

  return {
    success: true,
    dispute,
    chitty_id: chittyId
  };
}

/**
 * Get a dispute by UUID or ChittyID, with recent events.
 */
export async function disputeGet(sql, args) {
  const { id } = args;
  if (!id) throw new Error('id is required');

  const uuid = await resolveDisputeId(sql, id);

  const rows = await sql`
    SELECT * FROM public.disputes WHERE id = ${uuid}::uuid AND deleted_at IS NULL
  `;

  if (rows.length === 0) {
    throw new Error('Dispute not found');
  }

  const events = await sql`
    SELECT * FROM public.dispute_events
    WHERE dispute_id = ${uuid}::uuid
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return {
    success: true,
    dispute: rows[0],
    events
  };
}

/**
 * List disputes with filters.
 * Builds WHERE clauses conditionally to avoid casting NULL to enum types.
 */
export async function disputeList(sql, args) {
  const {
    status = null,
    type = null,
    severity = null,
    property = null,
    party = null,
    limit = 50,
    offset = 0
  } = args;

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);

  // Build conditional filter fragments
  const statusFilter = status ? sql`AND status = ${status}::dispute_status` : sql``;
  const typeFilter = type ? sql`AND dispute_type = ${type}::dispute_type` : sql``;
  const severityFilter = severity ? sql`AND severity = ${severity}::dispute_severity` : sql``;
  const propertyFilter = property ? sql`AND property_address ILIKE ${'%' + property + '%'}` : sql``;
  const partyFilter = party ? sql`AND parties::text ILIKE ${'%' + party + '%'}` : sql``;

  const rows = await sql`
    SELECT id, chitty_id, title, dispute_type, severity, status, domains,
           property_address, property_unit, assigned_to, parties,
           next_action_date, next_action_description,
           response_deadline, resolution_deadline,
           created_at, updated_at
    FROM public.disputes
    WHERE deleted_at IS NULL
      ${statusFilter}
      ${typeFilter}
      ${severityFilter}
      ${propertyFilter}
      ${partyFilter}
    ORDER BY
      CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END,
      next_action_date ASC NULLS LAST,
      created_at DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `;

  return {
    success: true,
    disputes: rows,
    count: rows.length,
    pagination: { limit: safeLimit, offset: safeOffset }
  };
}

/**
 * Update a dispute.
 * Uses COALESCE pattern matching the production Worker.
 */
export async function disputeUpdate(sql, args) {
  const { id, ...fields } = args;
  if (!id) throw new Error('id is required');

  const uuid = await resolveDisputeId(sql, id);

  if (fields.status === 'RESOLVED' && !fields.resolution_type) {
    throw new Error('resolution_type is required when resolving a dispute');
  }

  const rows = await sql`
    UPDATE public.disputes SET
      title = COALESCE(${fields.title ?? null}, title),
      description = COALESCE(${fields.description ?? null}, description),
      severity = COALESCE(${fields.severity ?? null}::dispute_severity, severity),
      status = COALESCE(${fields.status ?? null}::dispute_status, status),
      assigned_to = COALESCE(${fields.assigned_to ?? null}, assigned_to),
      parties = COALESCE(${fields.parties ? JSON.stringify(fields.parties) : null}::jsonb, parties),
      estimated_cost = COALESCE(${fields.estimated_cost ?? null}, estimated_cost),
      actual_cost = COALESCE(${fields.actual_cost ?? null}, actual_cost),
      response_deadline = COALESCE(${fields.response_deadline ?? null}::timestamptz, response_deadline),
      resolution_deadline = COALESCE(${fields.resolution_deadline ?? null}::timestamptz, resolution_deadline),
      next_action_date = COALESCE(${fields.next_action_date ?? null}::timestamptz, next_action_date),
      next_action_description = COALESCE(${fields.next_action_description ?? null}, next_action_description),
      resolution_type = COALESCE(${fields.resolution_type ?? null}, resolution_type),
      resolution_notes = COALESCE(${fields.resolution_notes ?? null}, resolution_notes),
      resolved_at = CASE WHEN ${fields.status ?? null} = 'RESOLVED' THEN now() ELSE resolved_at END,
      tags = COALESCE(${fields.tags ?? null}, tags),
      metadata = COALESCE(${fields.metadata ? JSON.stringify(fields.metadata) : null}::jsonb, metadata),
      updated_by = ${fields.updated_by ?? 'chittymcp'}
    WHERE id = ${uuid}::uuid AND deleted_at IS NULL
    RETURNING *
  `;

  if (rows.length === 0) {
    throw new Error('Dispute not found');
  }

  return {
    success: true,
    dispute: rows[0]
  };
}

/**
 * Add a timeline event to a dispute.
 */
export async function disputeAddEvent(sql, args) {
  const {
    dispute_id,
    event_type,
    summary,
    details = {},
    actor = 'chittymcp'
  } = args;

  if (!dispute_id || !event_type || !summary) {
    throw new Error('dispute_id, event_type, and summary are required');
  }

  // Verify dispute exists
  const check = await sql`
    SELECT id FROM public.disputes WHERE id = ${dispute_id}::uuid AND deleted_at IS NULL
  `;
  if (check.length === 0) {
    throw new Error('Dispute not found');
  }

  const rows = await sql`
    INSERT INTO public.dispute_events (dispute_id, event_type, summary, details, actor)
    VALUES (
      ${dispute_id}::uuid,
      ${event_type},
      ${summary},
      ${JSON.stringify(details)}::jsonb,
      ${actor}
    )
    RETURNING *
  `;

  return {
    success: true,
    event: rows[0]
  };
}

/**
 * Get full timeline for a dispute.
 */
export async function disputeTimeline(sql, args) {
  const { dispute_id } = args;
  if (!dispute_id) throw new Error('dispute_id is required');

  const events = await sql`
    SELECT * FROM public.dispute_events
    WHERE dispute_id = ${dispute_id}::uuid
    ORDER BY created_at ASC
  `;

  return {
    success: true,
    dispute_id,
    timeline: events,
    count: events.length
  };
}

/**
 * Dashboard summary: counts by status/type, overdue, upcoming actions.
 */
export async function disputeSummary(sql) {
  const statusCounts = await sql`
    SELECT status::text, count(*)::int as count
    FROM public.disputes
    WHERE deleted_at IS NULL
    GROUP BY status
  `;

  const typeCounts = await sql`
    SELECT dispute_type::text, count(*)::int as count
    FROM public.disputes
    WHERE deleted_at IS NULL AND status NOT IN ('RESOLVED', 'CLOSED')
    GROUP BY dispute_type
  `;

  const overdue = await sql`
    SELECT count(*)::int as count
    FROM public.disputes
    WHERE deleted_at IS NULL
      AND status NOT IN ('RESOLVED', 'CLOSED')
      AND (response_deadline < now() OR resolution_deadline < now())
  `;

  const upcoming = await sql`
    SELECT id, chitty_id, title, dispute_type, severity, status,
           next_action_date, next_action_description, property_address
    FROM public.disputes
    WHERE deleted_at IS NULL
      AND status NOT IN ('RESOLVED', 'CLOSED')
      AND next_action_date IS NOT NULL
      AND next_action_date <= now() + interval '7 days'
    ORDER BY next_action_date ASC
    LIMIT 10
  `;

  return {
    success: true,
    by_status: Object.fromEntries(statusCounts.map(r => [r.status, r.count])),
    by_type: Object.fromEntries(typeCounts.map(r => [r.dispute_type, r.count])),
    overdue_count: overdue[0]?.count ?? 0,
    upcoming_actions: upcoming
  };
}
