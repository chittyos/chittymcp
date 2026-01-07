/**
 * Prompt Registry - reusable prompt templates
 */

const prompts = [
  {
    name: 'chittyos.summarize.result',
    description: 'Summarize a tool result into concise, user-friendly bullets',
    inputSchema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: { type: 'string', description: 'JSON or text to summarize' },
        maxBullets: { type: 'number', minimum: 1, maximum: 10 }
      }
    },
    render: (args) => {
      const max = args?.maxBullets ?? 5;
      return `Summarize the following content into up to ${max} concise bullets focusing on actions and key findings.\n\nCONTENT:\n${args?.data ?? ''}`;
    }
  },
  {
    name: 'chittyos.generate.search_query',
    description: 'Generate a boolean search query for evidence retrieval',
    inputSchema: {
      type: 'object',
      required: ['objective'],
      properties: {
        objective: { type: 'string' },
        keyTerms: { type: 'array', items: { type: 'string' } }
      }
    },
    render: (args) => {
      const terms = (args?.keyTerms || []).join(' ');
      return `Create a focused boolean search query for: ${args?.objective}. Include these terms where helpful: ${terms}. Output only the query.`;
    }
  }
  ,
  {
    name: 'chittyos.incident.summary',
    description: 'Summarize chronicle events into an incident report',
    inputSchema: {
      type: 'object',
      required: ['events'],
      properties: {
        events: { type: 'string', description: 'JSON array of chronicle events' },
        audience: { type: 'string', enum: ['engineering','leadership','support'] }
      }
    },
    render: (args) => {
      const audience = args?.audience || 'engineering';
      return `Create an incident summary for ${audience}. Include timeline, impact, detection, actions taken, and follow-ups.\n\nEvents JSON:\n${args?.events ?? '[]'}`;
    }
  },
  {
    name: 'chittyos.rca.scaffold',
    description: 'Root-cause analysis outline based on events and context',
    inputSchema: {
      type: 'object',
      required: ['context'],
      properties: {
        context: { type: 'string', description: 'Freeform context text' },
        hypotheses: { type: 'array', items: { type: 'string' } }
      }
    },
    render: (args) => {
      const hyps = (args?.hypotheses || []).map((h,i)=>`- H${i+1}: ${h}`).join('\n');
      return `Draft an RCA outline. Sections: Summary, Timeline, Contributing Factors, Root Cause, Corrective Actions, Preventive Measures.\n\nContext:\n${args?.context}\n\nHypotheses:\n${hyps}`;
    }
  },
  {
    name: 'chittyos.search.refine',
    description: 'Refine an evidence search intent into a boolean query and filters',
    inputSchema: {
      type: 'object',
      required: ['intent'],
      properties: {
        intent: { type: 'string' },
        mustInclude: { type: 'array', items: { type: 'string' } },
        exclude: { type: 'array', items: { type: 'string' } }
      }
    },
    render: (args) => {
      const must = (args?.mustInclude || []).join(' ');
      const ex = (args?.exclude || []).join(' ');
      return `Turn this intent into a boolean search query and a short list of structured filters (JSON).\nIntent: ${args?.intent}\nMust include: ${must}\nExclude: ${ex}\nOutput: 1) Query line; 2) JSON filters.`;
    }
  }
];

export const promptRegistry = {
  list() {
    return prompts.map(p => ({
      name: p.name,
      description: p.description,
      inputSchema: p.inputSchema
    }));
  },
  get(name) {
    return prompts.find(p => p.name === name) || null;
  },
  render(name, args) {
    const p = prompts.find(p => p.name === name);
    return p ? p.render(args) : null;
  }
};
