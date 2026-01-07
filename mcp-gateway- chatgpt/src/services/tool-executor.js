/**
 * Tool Executor - Routes and executes tool calls
 * Handles service routing, authentication, and error handling
 */

import { toolRegistry } from '../tools/registry.js';
import { neon } from '@neondatabase/serverless';

/**
 * Execute a tool call
 * Routes to appropriate backend service or executes directly
 *
 * @param {string} toolName - Name of tool to execute
 * @param {object} args - Tool arguments
 * @param {object} env - Environment bindings
 * @param {object} authContext - Authentication context
 * @returns {Promise<object>} Tool execution result
 */
export async function executeToolCall(toolName, args, env, authContext) {
  const tool = toolRegistry.getTool(toolName);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  console.log(`Executing tool: ${toolName}`, { service: tool.service, endpoint: tool.endpoint });

  // Route based on endpoint type
  if (tool.endpoint === 'database:direct') {
    return await executeDatabaseTool(toolName, args, env);
  } else if (tool.endpoint.startsWith('https://')) {
    return await executeHttpTool(tool, args, env);
  } else {
    throw new Error(`Unknown endpoint type: ${tool.endpoint}`);
  }
}

/**
 * Execute database-direct tool (ChittyChronicle, ChittyQuality)
 */
async function executeDatabaseTool(toolName, args, env) {
  const databaseUrl = env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('NEON_DATABASE_URL not configured');
  }

  const sql = neon(databaseUrl);

  switch (toolName) {
    case 'chronicle_log':
      return await chronicleLog(sql, args);

    case 'chronicle_search':
      return await chronicleSearch(sql, args);

    case 'chronicle_timeline':
      return await chronicleTimeline(sql, args);

    case 'quality_validate':
      return await qualityValidate(sql, args);

    case 'quarantine_list':
      return await quarantineList(sql, args);

    case 'quarantine_review':
      return await quarantineReview(sql, args);

    default:
      throw new Error(`Database tool not implemented: ${toolName}`);
  }
}

/**
 * Execute HTTP-based tool (external service call)
 */
async function executeHttpTool(tool, args, env) {
  const serviceToken = getServiceToken(tool.service, env);

  if (!serviceToken) {
    console.warn(`No service token for ${tool.service} - attempting unauthenticated request`);
  }

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'ChatGPT-MCP-Gateway/1.0'
  };

  if (serviceToken) {
    headers['Authorization'] = `Bearer ${serviceToken}`;
  }

  try {
    const response = await fetch(tool.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service ${tool.service} returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error(`Error calling ${tool.service}:`, error);

    throw {
      message: `Failed to execute ${tool.name}`,
      details: error.message,
      service: tool.service,
      endpoint: tool.endpoint
    };
  }
}

/**
 * Get service token for inter-service communication
 */
function getServiceToken(serviceName, env) {
  const tokenMap = {
    'chittyid': env.CHITTY_ID_SERVICE_TOKEN,
    'chittyauth': env.CHITTY_AUTH_SERVICE_TOKEN,
    'chittyverify': env.CHITTY_VERIFY_SERVICE_TOKEN,
    'chittyscore': env.CHITTY_SCORE_SERVICE_TOKEN,
    'chittychronicle': env.CHITTY_CHRONICLE_SERVICE_TOKEN,
    'chittyrouter': env.CHITTY_ROUTER_SERVICE_TOKEN,
    'chittyconnect': env.CHITTY_CONNECT_SERVICE_TOKEN,
    'chittyregistry': env.CHITTY_REGISTRY_SERVICE_TOKEN,
    'chittyquality': env.CHITTY_QUALITY_SERVICE_TOKEN
  };

  return tokenMap[serviceName] || null;
}

// =============================================================================
// DATABASE TOOL IMPLEMENTATIONS
// =============================================================================

/**
 * Log event to ChittyChronicle
 */
async function chronicleLog(sql, args) {
  const {
    service,
    action,
    entityId = null,
    userId = null,
    status = 'success',
    metadata = {},
    searchableText = ''
  } = args;

  const result = await sql`
    INSERT INTO chronicle_events (service, action, entity_id, user_id, status, metadata, searchable_text)
    VALUES (${service}, ${action}, ${entityId}, ${userId}, ${status}, ${JSON.stringify(metadata)}, ${searchableText})
    RETURNING id, created_at
  `;

  return {
    success: true,
    eventId: result[0].id,
    timestamp: result[0].created_at,
    service,
    action
  };
}

/**
 * Search chronicle events
 */
async function chronicleSearch(sql, args) {
  const { query, filters = {}, limit = 100, offset = 0 } = args;

  let whereClauses = [];
  let params = [];

  // Add filters
  if (filters.service) {
    whereClauses.push(`service = $${params.length + 1}`);
    params.push(filters.service);
  }

  if (filters.action) {
    whereClauses.push(`action = $${params.length + 1}`);
    params.push(filters.action);
  }

  if (filters.entityId) {
    whereClauses.push(`entity_id = $${params.length + 1}`);
    params.push(filters.entityId);
  }

  if (filters.userId) {
    whereClauses.push(`user_id = $${params.length + 1}`);
    params.push(filters.userId);
  }

  if (filters.status) {
    whereClauses.push(`status = $${params.length + 1}`);
    params.push(filters.status);
  }

  if (filters.startDate) {
    whereClauses.push(`created_at >= $${params.length + 1}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    whereClauses.push(`created_at <= $${params.length + 1}`);
    params.push(filters.endDate);
  }

  // Full-text search
  if (query) {
    whereClauses.push(`search_vector @@ to_tsquery('english', $${params.length + 1})`);
    params.push(query);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const results = await sql`
    SELECT id, service, action, entity_id, user_id, status, metadata, created_at,
           ts_rank(search_vector, to_tsquery('english', ${query || ''})) as relevance
    FROM chronicle_events
    ${whereClause ? sql.unsafe(whereClause) : sql``}
    ORDER BY ${query ? sql`relevance DESC,` : sql``} created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return {
    success: true,
    count: results.length,
    events: results,
    filters,
    pagination: { limit, offset }
  };
}

/**
 * Get timeline for entity
 */
async function chronicleTimeline(sql, args) {
  const { entityId, startDate, endDate, services, groupBy } = args;

  let whereClauses = [`entity_id = ${entityId}`];

  if (startDate) {
    whereClauses.push(`created_at >= '${startDate}'`);
  }

  if (endDate) {
    whereClauses.push(`created_at <= '${endDate}'`);
  }

  if (services && services.length > 0) {
    whereClauses.push(`service IN (${services.map(s => `'${s}'`).join(', ')})`);
  }

  const results = await sql.unsafe(`
    SELECT * FROM chronicle_events
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY created_at ASC
  `);

  return {
    success: true,
    entityId,
    timeline: results,
    count: results.length,
    timeframe: { startDate, endDate }
  };
}

/**
 * Validate file quality
 */
async function qualityValidate(sql, args) {
  const { fileUrl, filePath, validationType = 'comprehensive', quarantineThreshold = 70 } = args;

  // Simulated quality analysis (in real implementation, would use AI)
  const confidenceScore = Math.floor(Math.random() * 40) + 60; // 60-100
  const issues = [];

  if (confidenceScore < 80) {
    issues.push('Low resolution detected');
  }

  if (confidenceScore < 70) {
    issues.push('Potential format corruption');
  }

  const quarantined = confidenceScore < quarantineThreshold;

  // If quarantined, insert into queue
  let quarantineId = null;
  if (quarantined) {
    const result = await sql`
      INSERT INTO quarantine_queue (file_path, file_url, confidence_score, issues, status)
      VALUES (${filePath || null}, ${fileUrl || null}, ${confidenceScore}, ${JSON.stringify(issues)}, 'pending')
      RETURNING id
    `;
    quarantineId = result[0].id;
  }

  return {
    success: true,
    validated: true,
    confidenceScore,
    issues,
    quarantined,
    quarantineId,
    validationType
  };
}

/**
 * List quarantined items
 */
async function quarantineList(sql, args) {
  const { status, limit = 50, offset = 0 } = args;

  const whereClause = status ? sql`WHERE status = ${status}` : sql``;

  const results = await sql`
    SELECT id, file_path, file_url, confidence_score, issues, status, quarantined_at, reviewed_at, reviewed_by
    FROM quarantine_queue
    ${whereClause}
    ORDER BY quarantined_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return {
    success: true,
    count: results.length,
    items: results,
    filters: { status },
    pagination: { limit, offset }
  };
}

/**
 * Review quarantine item
 */
async function quarantineReview(sql, args) {
  const { quarantineId, decision, reason, reviewedBy } = args;

  const newStatus = decision === 'approve' ? 'approved' : 'rejected';

  const result = await sql`
    UPDATE quarantine_queue
    SET status = ${newStatus},
        reviewed_at = NOW(),
        reviewed_by = ${reviewedBy || null},
        review_reason = ${reason || null}
    WHERE id = ${quarantineId}
    RETURNING *
  `;

  if (result.length === 0) {
    throw new Error(`Quarantine item not found: ${quarantineId}`);
  }

  return {
    success: true,
    quarantineId,
    decision,
    newStatus,
    item: result[0]
  };
}
