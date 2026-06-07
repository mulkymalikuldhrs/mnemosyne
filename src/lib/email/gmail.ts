// ============================================================
// MNEMOSYNE v1.0.0 — Gmail Email Provider
// Universal AI/Human Memory Hub: Email Integration Layer
//
// Implements EmailProviderInterface for Gmail via the
// Gmail REST API (v1) with OAuth2 authentication,
// rate limiting, and pagination handling.
// ============================================================

import {
  type EmailProviderInterface,
  type EmailProvider,
  type EmailAccountConfig,
  type EmailMessage,
  type EmailAddress,
  type EmailListOptions,
  type EmailListResult,
  EmailProviderError,
  RateLimiter,
} from './types'

// --- Constants ---

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const GMAIL_AUTH_BASE = 'https://oauth2.googleapis.com'
const DEFAULT_PAGE_SIZE = 50
const MAX_RETRIES = 3

/**
 * Gmail provider — implements EmailProviderInterface.
 *
 * Uses the Gmail REST API (v1) for all operations:
 *  - OAuth2 token management (authenticate + auto-refresh)
 *  - List / get / search / send / modify / delete messages
 *  - Automatic pagination and rate-limit handling
 *
 * Note: This provider is designed for server-side use only.
 * OAuth2 tokens must be obtained through a separate auth flow
 * and passed via EmailAccountConfig.
 */
export class GmailProvider implements EmailProviderInterface {
  readonly providerType: EmailProvider = 'gmail'

  private accessToken: string = ''
  private refreshToken: string = ''
  private clientId: string = ''
  private clientSecret: string = ''
  private redirectUri: string = ''
  private isAuthenticated: boolean = false
  private tokenExpiry: number = 0

  /** Rate limiter: Gmail API allows ~250 requests per second per user */
  private rateLimiter: RateLimiter = new RateLimiter(20, 1000) // 20 req/s conservative

  // --- Authentication ---

  /**
   * Authenticate with Gmail using OAuth2 credentials.
   * Validates the access token and attempts to refresh if expired.
   *
   * @param credentials - Gmail OAuth2 configuration
   * @throws {EmailProviderError} If authentication fails
   */
  async authenticate(credentials: EmailAccountConfig): Promise<void> {
    if (credentials.provider !== 'gmail') {
      throw new EmailProviderError(
        'gmail',
        'CONFIGURATION_ERROR',
        'GmailProvider requires provider type "gmail"'
      )
    }

    this.accessToken = credentials.accessToken ?? ''
    this.refreshToken = credentials.refreshToken ?? ''
    this.clientId = credentials.clientId ?? ''
    this.clientSecret = credentials.clientSecret ?? ''
    this.redirectUri = credentials.redirectUri ?? ''

    if (!this.accessToken && !this.refreshToken) {
      throw new EmailProviderError(
        'gmail',
        'AUTH_FAILED',
        'Gmail authentication requires an access token or refresh token'
      )
    }

    // If we have an access token, verify it works
    if (this.accessToken) {
      try {
        const profile = await this.apiRequest(`${GMAIL_API_BASE}/profile`) as { emailAddress?: string } | null
        if (profile && profile.emailAddress) {
          this.isAuthenticated = true
          return
        }
      } catch {
        // Token may be expired, try refresh
      }
    }

    // Try to refresh the access token
    if (this.refreshToken) {
      await this.refreshAccessToken()
      this.isAuthenticated = true
      return
    }

    throw new EmailProviderError(
      'gmail',
      'AUTH_EXPIRED',
      'Gmail access token expired and no refresh token available'
    )
  }

  // --- List Messages ---

  /**
   * List email messages from Gmail.
   * Handles pagination via page tokens.
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of email messages
   */
  async listMessages(options?: EmailListOptions): Promise<EmailListResult> {
    this.ensureAuthenticated()

    const limit = options?.limit ?? DEFAULT_PAGE_SIZE
    const params = new URLSearchParams()
    params.set('maxResults', String(limit))
    if (options?.pageToken) params.set('pageToken', options.pageToken)

    // Build Gmail query string
    const queryParts: string[] = []
    if (options?.afterDate) {
      queryParts.push(`after:${Math.floor(options.afterDate.getTime() / 1000)}`)
    }
    if (options?.beforeDate) {
      queryParts.push(`before:${Math.floor(options.beforeDate.getTime() / 1000)}`)
    }
    if (options?.label) {
      queryParts.push(`label:${options.label}`)
    }
    if (options?.unreadOnly) {
      queryParts.push('is:unread')
    }
    if (queryParts.length > 0) {
      params.set('q', queryParts.join(' '))
    }

    try {
      await this.rateLimiter.acquire()
      const listResponse = await this.apiRequest(
        `${GMAIL_API_BASE}/messages?${params.toString()}`
      ) as GmailMessageListResponse

      const messages: EmailMessage[] = []

      if (listResponse.messages && listResponse.messages.length > 0) {
        // Fetch full message details for each message ID
        // Process in batches to respect rate limits
        const batchResults = await this.fetchMessageBatch(
          listResponse.messages.map((m) => m.id)
        )
        messages.push(...batchResults)
      }

      return {
        messages,
        nextPageToken: listResponse.nextPageToken ?? null,
        totalEstimate: listResponse.resultSizeEstimate,
      }
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'gmail',
        'PROTOCOL_ERROR',
        `Failed to list Gmail messages: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Get Single Message ---

  /**
   * Get a single email message by its Gmail message ID.
   *
   * @param messageId - Gmail message ID (not RFC 2822 Message-ID)
   * @returns The full email message
   */
  async getMessage(messageId: string): Promise<EmailMessage> {
    this.ensureAuthenticated()

    try {
      await this.rateLimiter.acquire()
      const raw = await this.apiRequest(
        `${GMAIL_API_BASE}/messages/${messageId}?format=full`
      ) as GmailMessageResponse

      return this.convertGmailMessage(raw)
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      if (error instanceof Error && error.message.includes('404')) {
        throw new EmailProviderError(
          'gmail',
          'MESSAGE_NOT_FOUND',
          `Gmail message not found: ${messageId}`,
          error
        )
      }
      throw new EmailProviderError(
        'gmail',
        'PROTOCOL_ERROR',
        `Failed to get Gmail message: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Search Messages ---

  /**
   * Search Gmail messages using Gmail's query syntax.
   *
   * @param query - Gmail search query (supports full Gmail query syntax)
   * @returns Matching email messages
   */
  async searchMessages(query: string): Promise<EmailMessage[]> {
    this.ensureAuthenticated()

    const params = new URLSearchParams()
    params.set('q', query)
    params.set('maxResults', '20')

    try {
      await this.rateLimiter.acquire()
      const listResponse = await this.apiRequest(
        `${GMAIL_API_BASE}/messages?${params.toString()}`
      ) as GmailMessageListResponse

      if (!listResponse.messages || listResponse.messages.length === 0) {
        return []
      }

      return this.fetchMessageBatch(
        listResponse.messages.map((m) => m.id)
      )
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'gmail',
        'SEARCH_FAILED',
        `Gmail search failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Send Message ---

  /**
   * Send an email via Gmail.
   * Constructs a MIME message and sends via the Gmail API.
   *
   * @param to - Recipient addresses
   * @param subject - Email subject
   * @param body - Email body
   * @param isHtml - Whether the body is HTML (default false)
   */
  async sendMessage(
    to: EmailAddress[],
    subject: string,
    body: string,
    isHtml: boolean = false
  ): Promise<void> {
    this.ensureAuthenticated()

    if (!to || to.length === 0) {
      throw new EmailProviderError(
        'gmail',
        'SEND_FAILED',
        'At least one recipient address is required'
      )
    }

    try {
      const mimeMessage = this.buildMimeMessage(to, subject, body, isHtml)
      const encodedMessage = Buffer.from(mimeMessage)
        .toString('base64url')

      await this.rateLimiter.acquire()
      await this.apiRequest(`${GMAIL_API_BASE}/messages/send`, {
        method: 'POST',
        body: JSON.stringify({ raw: encodedMessage }),
      })
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'gmail',
        'SEND_FAILED',
        `Failed to send Gmail message: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Mark as Read ---

  /**
   * Mark a Gmail message as read by removing the UNREAD label.
   *
   * @param messageId - Gmail message ID
   */
  async markAsRead(messageId: string): Promise<void> {
    this.ensureAuthenticated()

    try {
      await this.rateLimiter.acquire()
      await this.apiRequest(
        `${GMAIL_API_BASE}/messages/${messageId}/modify`,
        {
          method: 'POST',
          body: JSON.stringify({
            removeLabelIds: ['UNREAD'],
          }),
        }
      )
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'gmail',
        'PROTOCOL_ERROR',
        `Failed to mark Gmail message as read: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Delete Message ---

  /**
   * Delete a Gmail message (moves to trash).
   *
   * @param messageId - Gmail message ID
   */
  async deleteMessage(messageId: string): Promise<void> {
    this.ensureAuthenticated()

    try {
      await this.rateLimiter.acquire()
      await this.apiRequest(
        `${GMAIL_API_BASE}/messages/${messageId}/trash`,
        { method: 'POST' }
      )
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'gmail',
        'PROTOCOL_ERROR',
        `Failed to delete Gmail message: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Disconnect ---

  /**
   * Disconnect and clear credentials.
   */
  async disconnect(): Promise<void> {
    this.accessToken = ''
    this.refreshToken = ''
    this.isAuthenticated = false
    this.tokenExpiry = 0
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Ensure the provider is authenticated before making API calls.
   */
  private ensureAuthenticated(): void {
    if (!this.isAuthenticated) {
      throw new EmailProviderError(
        'gmail',
        'AUTH_FAILED',
        'GmailProvider is not authenticated. Call authenticate() first.'
      )
    }
  }

  /**
   * Refresh the OAuth2 access token using the refresh token.
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new EmailProviderError(
        'gmail',
        'AUTH_EXPIRED',
        'Cannot refresh token: missing refresh token or client credentials'
      )
    }

    try {
      const response = await fetch(`${GMAIL_AUTH_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new EmailProviderError(
          'gmail',
          'AUTH_EXPIRED',
          `Failed to refresh Gmail access token: ${response.status} ${errorBody}`
        )
      }

      const data = await response.json() as {
        access_token: string
        expires_in?: number
        token_type?: string
      }

      this.accessToken = data.access_token
      this.tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'gmail',
        'AUTH_EXPIRED',
        `Failed to refresh Gmail access token: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  /**
   * Make an authenticated API request to the Gmail API.
   * Handles token refresh and retries automatically.
   */
  private async apiRequest(
    url: string,
    options?: { method?: string; body?: string },
    retryCount: number = 0
  ): Promise<unknown> {
    // Check if token needs refresh
    if (this.tokenExpiry > 0 && Date.now() >= this.tokenExpiry - 60000) {
      await this.refreshAccessToken()
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body,
    })

    // Handle rate limiting
    if (response.status === 429) {
      if (retryCount < MAX_RETRIES) {
        const backoff = Math.pow(2, retryCount) * 1000 + Math.random() * 500
        await new Promise((resolve) => setTimeout(resolve, backoff))
        return this.apiRequest(url, options, retryCount + 1)
      }
      throw new EmailProviderError(
        'gmail',
        'RATE_LIMITED',
        'Gmail API rate limit exceeded. Please retry later.'
      )
    }

    // Handle auth errors
    if (response.status === 401) {
      if (retryCount < 1 && this.refreshToken) {
        await this.refreshAccessToken()
        return this.apiRequest(url, options, retryCount + 1)
      }
      throw new EmailProviderError(
        'gmail',
        'AUTH_EXPIRED',
        'Gmail access token is invalid or expired'
      )
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text()
      throw new EmailProviderError(
        'gmail',
        'PROTOCOL_ERROR',
        `Gmail API error: ${response.status} ${errorText}`
      )
    }

    // Some endpoints return empty responses (e.g., trash, modify)
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    }
    return null
  }

  /**
   * Fetch full message details for a batch of message IDs.
   * Processes in parallel with rate limiting.
   */
  private async fetchMessageBatch(
    messageIds: string[]
  ): Promise<EmailMessage[]> {
    const results: EmailMessage[] = []
    const batchSize = 10

    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize)
      const batchPromises = batch.map(async (id) => {
        await this.rateLimiter.acquire()
        try {
          const raw = await this.apiRequest(
            `${GMAIL_API_BASE}/messages/${id}?format=full`
          ) as GmailMessageResponse
          return this.convertGmailMessage(raw)
        } catch (error) {
          // Skip individual failures — don't break the whole batch
          console.error(
            `Failed to fetch Gmail message ${id}:`,
            error instanceof Error ? error.message : String(error)
          )
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      for (const result of batchResults) {
        if (result) results.push(result)
      }
    }

    return results
  }

  /**
   * Convert a Gmail API message response to our EmailMessage format.
   */
  private convertGmailMessage(raw: GmailMessageResponse): EmailMessage {
    const headers = raw.payload?.headers ?? []
    const getHeader = (name: string): string =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

    const from = this.parseEmailAddress(getHeader('from'))
    const toAddresses = this.parseEmailAddresses(getHeader('to'))
    const messageIdHeader = getHeader('message-id')
    const dateStr = getHeader('date')
    const date = dateStr ? new Date(dateStr) : new Date(raw.internalDate ?? Date.now())

    // Extract body content
    const { text, html } = this.extractBody(raw.payload)

    // Extract labels
    const labels = raw.labelIds ?? []

    return {
      id: raw.id,
      messageId: messageIdHeader || raw.id,
      from,
      to: toAddresses,
      subject: getHeader('subject'),
      bodyText: text,
      bodyHtml: html,
      date,
      isRead: !labels.includes('UNREAD'),
      isStarred: labels.includes('STARRED'),
      labels,
    }
  }

  /**
   * Parse a single email address from a header string.
   * Handles formats like "Name <email@example.com>" or "email@example.com".
   */
  private parseEmailAddress(header: string): EmailAddress {
    const match = header.match(/^(.+?)\s*<([^>]+)>/)
    if (match) {
      return { name: match[1].trim().replace(/^"|"$/g, ''), address: match[2].trim() }
    }
    return { address: header.trim() }
  }

  /**
   * Parse multiple email addresses from a header string.
   */
  private parseEmailAddresses(header: string): EmailAddress[] {
    if (!header.trim()) return []
    return header
      .split(',')
      .map((part) => this.parseEmailAddress(part))
      .filter((addr) => addr.address.length > 0)
  }

  /**
   * Extract plain-text and HTML body from a Gmail message payload.
   * Recursively searches through message parts.
   */
  private extractBody(
    payload: GmailMessagePayload | undefined
  ): { text: string; html: string } {
    if (!payload) return { text: '', html: '' }

    let text = ''
    let html = ''

    // If the payload has parts, search recursively
    if (payload.parts && payload.parts.length > 0) {
      for (const part of payload.parts) {
        const result = this.extractBody(part)
        if (result.text) text += result.text
        if (result.html) html += result.html
      }
    }

    // If the payload has a direct body
    if (payload.body?.data) {
      const decoded = this.decodeBase64Url(payload.body.data)
      if (payload.mimeType === 'text/plain') {
        text = decoded
      } else if (payload.mimeType === 'text/html') {
        html = decoded
      }
    }

    return { text, html }
  }

  /**
   * Decode a Base64URL-encoded string.
   */
  private decodeBase64Url(data: string): string {
    // Gmail API uses Base64URL encoding
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    return Buffer.from(base64 + padding, 'base64').toString('utf-8')
  }

  /**
   * Build a simple MIME message for sending.
   */
  private buildMimeMessage(
    to: EmailAddress[],
    subject: string,
    body: string,
    isHtml: boolean
  ): string {
    const toHeader = to
      .map((addr) => (addr.name ? `${addr.name} <${addr.address}>` : addr.address))
      .join(', ')

    const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'
    const subjectEncoded = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`

    const lines: string[] = [
      `To: ${toHeader}`,
      `Subject: ${subjectEncoded}`,
      `Content-Type: ${contentType}`,
      'MIME-Version: 1.0',
      '',
      body,
    ]

    return lines.join('\r\n')
  }
}

// ============================================================
// Gmail API Response Types (internal)
// ============================================================

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

interface GmailMessageResponse {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: GmailMessagePayload
}

interface GmailMessagePayload {
  headers?: Array<{ name: string; value: string }>
  mimeType?: string
  body?: { data?: string; size?: number; attachmentId?: string }
  parts?: GmailMessagePayload[]
}
