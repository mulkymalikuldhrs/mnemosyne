import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/notes',
    description: 'List all notes for the authenticated user',
    params: 'page, limit, tags, search',
  },
  {
    method: 'POST',
    path: '/api/notes',
    description: 'Create a new note',
    params: 'title, content, tags',
  },
  {
    method: 'GET',
    path: '/api/notes/:id',
    description: 'Get a specific note by ID',
    params: 'id (path)',
  },
  {
    method: 'PUT',
    path: '/api/notes/:id',
    description: 'Update an existing note',
    params: 'title, content, tags, isArchived',
  },
  {
    method: 'DELETE',
    path: '/api/notes/:id',
    description: 'Delete a note and its associated data',
    params: 'id (path)',
  },
  {
    method: 'POST',
    path: '/api/chat',
    description: 'Send a message to the AI chat with memory context',
    params: 'message, conversationId',
  },
  {
    method: 'GET',
    path: '/api/chat',
    description: 'List conversations for the authenticated user',
    params: 'page, limit',
  },
  {
    method: 'GET',
    path: '/api/search',
    description: 'Semantic search across all notes',
    params: 'q (query), limit',
  },
  {
    method: 'GET',
    path: '/api/memory/insights',
    description: 'Get memory insights and pattern analysis',
    params: '-',
  },
  {
    method: 'GET',
    path: '/api/memory/related/:noteId',
    description: 'Get notes related to a specific note',
    params: 'noteId (path), limit',
  },
  {
    method: 'GET',
    path: '/api/decisions',
    description: 'List all decisions for the authenticated user',
    params: 'page, limit, status',
  },
  {
    method: 'POST',
    path: '/api/decisions',
    description: 'Record a new decision',
    params: 'title, context, reasoning, decision, alternatives, outcome, status',
  },
  {
    method: 'PUT',
    path: '/api/decisions/:id',
    description: 'Update a decision (e.g., change status)',
    params: 'id (path), status, outcome',
  },
  {
    method: 'GET',
    path: '/api/settings',
    description: 'Get user settings and configuration',
    params: '-',
  },
  {
    method: 'PUT',
    path: '/api/settings',
    description: 'Update user settings',
    params: 'openrouterApiKey, supabaseProjectUrl',
  },
  {
    method: 'GET',
    path: '/api/api-keys',
    description: 'List API keys for the authenticated user',
    params: '-',
  },
  {
    method: 'POST',
    path: '/api/api-keys',
    description: 'Generate a new API key',
    params: 'name',
  },
  {
    method: 'DELETE',
    path: '/api/api-keys/:id',
    description: 'Revoke an API key',
    params: 'id (path)',
  },
  {
    method: 'GET',
    path: '/api/health',
    description: 'Health check endpoint (no auth required)',
    params: '-',
  },
  {
    method: 'POST',
    path: '/api/auth/register',
    description: 'Register a new account',
    params: 'email, password, name',
  },
]

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  DELETE: 'bg-rose-500/15 text-rose-600 border-rose-500/30',
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Memorix API Documentation
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            RESTful API for the Memorix AI Memory SaaS platform. All endpoints
            require authentication via session cookie or Bearer token unless
            noted otherwise.
          </p>
        </div>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Most endpoints require authentication. Include one of the following
              with each request:
            </p>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium mb-1">Session Cookie</p>
                <p className="text-xs text-muted-foreground">
                  After signing in via NextAuth, the session cookie is sent
                  automatically with each request.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium mb-1">API Key (Bearer Token)</p>
                <p className="text-xs text-muted-foreground">
                  Include your API key in the Authorization header:{' '}
                  <code className="text-xs bg-background px-1.5 py-0.5 rounded font-mono">
                    Authorization: Bearer mx_your_api_key
                  </code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Format */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              All API responses follow a consistent JSON format:
            </p>
            <pre className="text-xs bg-muted/80 p-4 rounded-lg overflow-x-auto font-mono">
{`{
  "success": true,
  "data": { ... },
  "error": null
}

// Error response:
{
  "success": false,
  "error": "Error message describing what went wrong"
}`}
            </pre>
            <p className="text-xs text-muted-foreground">
              Paginated endpoints also include <code className="font-mono">total</code>,{' '}
              <code className="font-mono">page</code>, and <code className="font-mono">limit</code> fields.
            </p>
          </CardContent>
        </Card>

        <Separator />

        {/* Endpoints */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Endpoints</h2>
          <div className="space-y-3">
            {ENDPOINTS.map((endpoint) => (
              <Card key={`${endpoint.method}-${endpoint.path}`} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[11px] px-2 py-0.5 ${METHOD_COLORS[endpoint.method] || ''}`}
                      >
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm font-mono font-medium">
                        {endpoint.path}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground sm:ml-auto sm:text-right">
                      {endpoint.description}
                    </p>
                  </div>
                  {endpoint.params !== '-' && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-medium">Parameters:</span>{' '}
                        <code className="font-mono">{endpoint.params}</code>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Rate Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate Limits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>API requests are rate-limited to prevent abuse:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>General API: <strong>60 requests/minute</strong></li>
              <li>Chat endpoints: <strong>20 requests/minute</strong></li>
              <li>Memory operations: <strong>30 requests/minute</strong></li>
            </ul>
            <p className="text-xs mt-2">
              Rate-limited responses return HTTP 429 with a{' '}
              <code className="font-mono">Retry-After</code> header.
            </p>
          </CardContent>
        </Card>

        {/* MCP Server */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MCP Server</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Memorix provides an MCP (Model Context Protocol) server for
              integration with AI assistants like Claude, Cursor, and VS Code.
            </p>
            <pre className="text-xs bg-muted/80 p-3 rounded-lg font-mono overflow-x-auto">
{`# Install and run
npx @memorix/mcp-server --db ./memorix.db

# Available tools:
# memorix_search   — Search user memory
# memorix_add_note — Add note to memory
# memorix_get_note — Get specific note
# memorix_list_notes — List all notes
# memorix_chat     — Chat with memory
# memorix_get_related — Get related notes
# memorix_detect_patterns — Detect memory patterns
# memorix_add_decision — Record a decision`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
