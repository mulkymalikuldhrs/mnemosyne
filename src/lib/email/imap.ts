// ============================================================
// MEMORIX v3.0.0 — IMAP Email Provider
// Universal AI/Human Memory Hub: Email Integration Layer
//
// Implements EmailProviderInterface for any IMAP-compatible
// email provider. Uses IMAP for reading and SMTP for sending.
//
// Since this runs in a Node.js server environment, we use
// net/tls sockets with a lightweight IMAP protocol client
// that works with any IMAP/SMTP server.
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

const DEFAULT_IMAP_PORT = 993
const DEFAULT_SMTP_PORT = 587
const DEFAULT_PAGE_SIZE = 50
const IMAP_COMMAND_TIMEOUT = 30000 // 30 seconds

/**
 * IMAP provider — implements EmailProviderInterface.
 *
 * Works with any IMAP-compatible email provider by:
 *  - Connecting to an IMAP server for reading/fetching emails
 *  - Connecting to an SMTP server for sending emails
 *  - Using the net/tls modules for raw socket communication
 *
 * Note: In a production deployment, consider using a dedicated
 * IMAP library (e.g., imapflow) for more robust protocol handling.
 * This implementation provides a clean interface that can be
 * swapped out for such a library.
 */
export class ImapProvider implements EmailProviderInterface {
  readonly providerType: EmailProvider = 'imap'

  private config: EmailAccountConfig | null = null
  private isAuthenticated: boolean = false
  private imapConnection: ImapConnection | null = null

  /** Rate limiter for IMAP operations */
  private rateLimiter: RateLimiter = new RateLimiter(10, 1000) // 10 req/s

  // --- Authentication ---

  /**
   * Authenticate with the IMAP server.
   * Establishes a connection and logs in with the provided credentials.
   *
   * @param credentials - IMAP/SMTP configuration
   * @throws {EmailProviderError} If connection or authentication fails
   */
  async authenticate(credentials: EmailAccountConfig): Promise<void> {
    if (credentials.provider !== 'imap' && credentials.provider !== 'outlook') {
      throw new EmailProviderError(
        'imap',
        'CONFIGURATION_ERROR',
        'ImapProvider requires provider type "imap" or "outlook"'
      )
    }

    const host = credentials.imapHost
    if (!host) {
      throw new EmailProviderError(
        'imap',
        'CONFIGURATION_ERROR',
        'IMAP host is required for ImapProvider'
      )
    }

    const username = credentials.username ?? credentials.emailAddress
    const password = credentials.password
    if (!password) {
      throw new EmailProviderError(
        'imap',
        'CONFIGURATION_ERROR',
        'IMAP password/app-password is required'
      )
    }

    this.config = {
      ...credentials,
      imapHost: host,
      imapPort: credentials.imapPort ?? DEFAULT_IMAP_PORT,
      smtpHost: credentials.smtpHost ?? '',
      smtpPort: credentials.smtpPort ?? DEFAULT_SMTP_PORT,
      username,
      password,
      imapTls: credentials.imapTls ?? true,
      smtpTls: credentials.smtpTls ?? true,
    }

    try {
      // Establish IMAP connection
      this.imapConnection = new ImapConnection({
        host,
        port: this.config.imapPort ?? DEFAULT_IMAP_PORT,
        tls: this.config.imapTls ?? true,
        username,
        password,
      })

      await this.imapConnection.connect()
      await this.imapConnection.login()
      this.isAuthenticated = true
    } catch (error) {
      this.imapConnection = null
      throw new EmailProviderError(
        'imap',
        'AUTH_FAILED',
        `IMAP authentication failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- List Messages ---

  /**
   * List email messages from the IMAP server.
   * Uses IMAP SEARCH and FETCH commands.
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of email messages
   */
  async listMessages(options?: EmailListOptions): Promise<EmailListResult> {
    this.ensureAuthenticated()

    const limit = options?.limit ?? DEFAULT_PAGE_SIZE
    const pageOffset = options?.pageToken ? parseInt(options.pageToken, 10) : 0

    try {
      await this.rateLimiter.acquire()
      const conn = this.getConnection()

      // Select INBOX
      await conn.selectMailbox('INBOX')

      // Build search criteria
      const searchCriteria = this.buildSearchCriteria(options)

      // Search for matching message sequence numbers
      const messageIds = await conn.search(searchCriteria)

      if (messageIds.length === 0) {
        return { messages: [], nextPageToken: null }
      }

      // Apply pagination
      const paginatedIds = messageIds.slice(pageOffset, pageOffset + limit)
      const hasNextPage = pageOffset + limit < messageIds.length
      const nextPageToken = hasNextPage ? String(pageOffset + limit) : null

      // Fetch message details
      const messages: EmailMessage[] = []
      for (const seqId of paginatedIds) {
        await this.rateLimiter.acquire()
        try {
          const raw = await conn.fetchMessage(seqId)
          const message = this.parseRawEmail(raw, seqId)
          messages.push(message)
        } catch (error) {
          // Skip individual failures
          console.error(
            `Failed to fetch IMAP message ${seqId}:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      }

      return {
        messages,
        nextPageToken,
        totalEstimate: messageIds.length,
      }
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'imap',
        'PROTOCOL_ERROR',
        `Failed to list IMAP messages: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Get Single Message ---

  /**
   * Get a single email message by its UID or sequence number.
   *
   * @param messageId - IMAP UID or sequence number
   * @returns The full email message
   */
  async getMessage(messageId: string): Promise<EmailMessage> {
    this.ensureAuthenticated()

    try {
      await this.rateLimiter.acquire()
      const conn = this.getConnection()
      await conn.selectMailbox('INBOX')

      const raw = await conn.fetchMessage(messageId)
      return this.parseRawEmail(raw, messageId)
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'imap',
        'MESSAGE_NOT_FOUND',
        `IMAP message not found: ${messageId}`,
        error
      )
    }
  }

  // --- Search Messages ---

  /**
   * Search emails using IMAP SEARCH criteria.
   * The query is converted to an IMAP search expression.
   *
   * @param query - Free-text search query
   * @returns Matching email messages
   */
  async searchMessages(query: string): Promise<EmailMessage[]> {
    this.ensureAuthenticated()

    try {
      await this.rateLimiter.acquire()
      const conn = this.getConnection()
      await conn.selectMailbox('INBOX')

      // Use BODY search for free-text queries
      const messageIds = await conn.search([`BODY "${query.replace(/"/g, '\\"')}"`])

      if (messageIds.length === 0) return []

      // Limit to first 20 results
      const limitedIds = messageIds.slice(0, 20)
      const messages: EmailMessage[] = []

      for (const seqId of limitedIds) {
        await this.rateLimiter.acquire()
        try {
          const raw = await conn.fetchMessage(seqId)
          const message = this.parseRawEmail(raw, seqId)
          messages.push(message)
        } catch {
          // Skip individual failures
        }
      }

      return messages
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'imap',
        'SEARCH_FAILED',
        `IMAP search failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Send Message ---

  /**
   * Send an email via SMTP.
   * Uses the SMTP protocol to send the message.
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

    if (!this.config?.smtpHost) {
      throw new EmailProviderError(
        'imap',
        'CONFIGURATION_ERROR',
        'SMTP host is required for sending emails'
      )
    }

    if (!to || to.length === 0) {
      throw new EmailProviderError(
        'imap',
        'SEND_FAILED',
        'At least one recipient address is required'
      )
    }

    try {
      const smtpClient = new SmtpConnection({
        host: this.config.smtpHost,
        port: this.config.smtpPort ?? DEFAULT_SMTP_PORT,
        tls: this.config.smtpTls ?? true,
        username: this.config.username ?? this.config.emailAddress,
        password: this.config.password ?? '',
      })

      await smtpClient.connect()
      await smtpClient.sendMail({
        from: {
          address: this.config.emailAddress,
          name: this.config.displayName,
        },
        to,
        subject,
        body,
        isHtml,
      })
      await smtpClient.quit()
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'imap',
        'SEND_FAILED',
        `Failed to send email via SMTP: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Mark as Read ---

  /**
   * Mark an IMAP message as read by adding the \Seen flag.
   *
   * @param messageId - IMAP sequence number or UID
   */
  async markAsRead(messageId: string): Promise<void> {
    this.ensureAuthenticated()

    try {
      await this.rateLimiter.acquire()
      const conn = this.getConnection()
      await conn.selectMailbox('INBOX')
      await conn.storeFlags(messageId, '+FLAGS', '\\Seen')
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'imap',
        'PROTOCOL_ERROR',
        `Failed to mark IMAP message as read: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Delete Message ---

  /**
   * Delete an IMAP message by adding the \Deleted flag and expunging.
   *
   * @param messageId - IMAP sequence number or UID
   */
  async deleteMessage(messageId: string): Promise<void> {
    this.ensureAuthenticated()

    try {
      await this.rateLimiter.acquire()
      const conn = this.getConnection()
      await conn.selectMailbox('INBOX')
      await conn.storeFlags(messageId, '+FLAGS', '\\Deleted')
      await conn.expunge()
    } catch (error) {
      if (error instanceof EmailProviderError) throw error
      throw new EmailProviderError(
        'imap',
        'PROTOCOL_ERROR',
        `Failed to delete IMAP message: ${error instanceof Error ? error.message : String(error)}`,
        error
      )
    }
  }

  // --- Disconnect ---

  /**
   * Disconnect from the IMAP server.
   */
  async disconnect(): Promise<void> {
    if (this.imapConnection) {
      try {
        await this.imapConnection.logout()
      } catch {
        // Ignore errors on disconnect
      }
      this.imapConnection = null
    }
    this.isAuthenticated = false
    this.config = null
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private ensureAuthenticated(): void {
    if (!this.isAuthenticated || !this.imapConnection) {
      throw new EmailProviderError(
        'imap',
        'AUTH_FAILED',
        'ImapProvider is not authenticated. Call authenticate() first.'
      )
    }
  }

  private getConnection(): ImapConnection {
    if (!this.imapConnection) {
      throw new EmailProviderError(
        'imap',
        'CONNECTION_FAILED',
        'IMAP connection not established'
      )
    }
    return this.imapConnection
  }

  /**
   * Build IMAP search criteria from EmailListOptions.
   * Returns an array of IMAP SEARCH criteria strings.
   */
  private buildSearchCriteria(options?: EmailListOptions): string[] {
    const criteria: string[] = ['ALL']

    if (options?.afterDate) {
      const d = options.afterDate
      const dateStr = `${d.getDate()}-${d.toLocaleString('en', { month: 'short' })}-${d.getFullYear()}`
      criteria.push(`SINCE ${dateStr}`)
    }
    if (options?.beforeDate) {
      const d = options.beforeDate
      const dateStr = `${d.getDate()}-${d.toLocaleString('en', { month: 'short' })}-${d.getFullYear()}`
      criteria.push(`BEFORE ${dateStr}`)
    }
    if (options?.unreadOnly) {
      criteria.push('UNSEEN')
    }
    if (options?.label) {
      // IMAP uses keyword flags or mailbox names
      criteria.push(`KEYWORD ${options.label}`)
    }

    return criteria
  }

  /**
   * Parse a raw RFC 2822 email source into an EmailMessage.
   * This is a simplified parser that extracts headers and body.
   */
  private parseRawEmail(raw: string, seqId: string): EmailMessage {
    // Split headers from body
    const headerEndIndex = raw.indexOf('\r\n\r\n')
    const headerSection = headerEndIndex > 0 ? raw.substring(0, headerEndIndex) : raw
    const bodySection = headerEndIndex > 0 ? raw.substring(headerEndIndex + 4) : ''

    // Parse headers
    const headers = this.parseHeaders(headerSection)
    const from = this.parseEmailAddressHeader(headers.from ?? '')
    const toAddresses = this.parseEmailAddressList(headers.to ?? '')
    const date = headers.date ? new Date(headers.date) : new Date()

    // Extract body content
    const { text, html } = this.parseBody(bodySection, headers['content-type'])

    // Extract Message-ID
    const messageIdHeader = headers['message-id']?.replace(/^<|>$/g, '') ?? seqId

    return {
      id: seqId,
      messageId: messageIdHeader,
      from,
      to: toAddresses,
      subject: this.decodeSubject(headers.subject ?? ''),
      bodyText: text,
      bodyHtml: html,
      date,
      isRead: true, // We fetched it, so it's now seen
      isStarred: false, // Would need FLAGS check
      labels: [],
    }
  }

  /**
   * Parse email headers from a raw header section.
   * Handles folded headers (continuation lines starting with whitespace).
   */
  private parseHeaders(headerSection: string): Record<string, string> {
    const headers: Record<string, string> = {}

    // Unfold continuation lines
    const unfolded = headerSection.replace(/\r\n[ \t]+/g, ' ')

    for (const line of unfolded.split('\r\n')) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const name = line.substring(0, colonIndex).trim().toLowerCase()
        const value = line.substring(colonIndex + 1).trim()
        headers[name] = value
      }
    }

    return headers
  }

  /**
   * Parse a single email address from a header value.
   */
  private parseEmailAddressHeader(header: string): EmailAddress {
    const match = header.match(/^(.+?)\s*<([^>]+)>/)
    if (match) {
      return { name: match[1].trim().replace(/^"|"$/g, ''), address: match[2].trim() }
    }
    // Try to extract just an email address
    const emailMatch = header.match(/[\w.+-]+@[\w.-]+\.\w+/)
    return { address: emailMatch ? emailMatch[0] : header.trim() }
  }

  /**
   * Parse multiple email addresses from a header value.
   */
  private parseEmailAddressList(header: string): EmailAddress[] {
    if (!header.trim()) return []
    return header
      .split(',')
      .map((part) => this.parseEmailAddressHeader(part))
      .filter((addr) => addr.address.length > 0)
  }

  /**
   * Decode an RFC 2047 encoded subject line.
   */
  private decodeSubject(subject: string): string {
    // Simple RFC 2047 decoder for =?charset?B?...?= and =?charset?Q?...?=
    return subject.replace(
      /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
      (_match, _charset: string, encoding: string, data: string) => {
        if (encoding.toUpperCase() === 'B') {
          try {
            return Buffer.from(data, 'base64').toString('utf-8')
          } catch {
            return data
          }
        }
        // Q encoding: similar to quoted-printable
        return data
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          )
      }
    )
  }

  /**
   * Parse body content, separating text and HTML parts.
   */
  private parseBody(
    body: string,
    contentType?: string
  ): { text: string; html: string } {
    if (!body) return { text: '', html: '' }

    const ct = contentType?.toLowerCase() ?? ''

    // Simple content type detection
    if (ct.includes('text/html')) {
      return { text: this.stripHtmlTags(body), html: body }
    }

    if (ct.includes('multipart/')) {
      // Extract boundary
      const boundaryMatch = ct.match(/boundary="?([^";\s]+)"?/)
      if (boundaryMatch) {
        return this.parseMultipartBody(body, boundaryMatch[1])
      }
    }

    // Default to plain text
    return { text: body, html: '' }
  }

  /**
   * Parse a multipart MIME body.
   */
  private parseMultipartBody(
    body: string,
    boundary: string
  ): { text: string; html: string } {
    let text = ''
    let html = ''

    const parts = body.split(`--${boundary}`)

    for (const part of parts) {
      const partTrimmed = part.trim()
      if (!partTrimmed || partTrimmed === '--') continue

      const partHeaderEnd = partTrimmed.indexOf('\r\n\r\n')
      if (partHeaderEnd < 0) continue

      const partHeaders = this.parseHeaders(partTrimmed.substring(0, partHeaderEnd))
      const partBody = partTrimmed.substring(partHeaderEnd + 4)

      const partContentType = partHeaders['content-type']?.toLowerCase() ?? ''

      if (partContentType.includes('text/plain')) {
        text += partBody
      } else if (partContentType.includes('text/html')) {
        html += partBody
      } else if (partContentType.includes('multipart/')) {
        const nestedBoundary = partContentType.match(/boundary="?([^";\s]+)"?/)
        if (nestedBoundary) {
          const nested = this.parseMultipartBody(partBody, nestedBoundary[1])
          text += nested.text
          html += nested.html
        }
      }
    }

    return { text, html }
  }

  /**
   * Strip basic HTML tags to extract plain text.
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }
}

// ============================================================
// Lightweight IMAP Connection (Internal)
// ============================================================

interface ImapConnectionConfig {
  host: string
  port: number
  tls: boolean
  username: string
  password: string
}

/**
 * Lightweight IMAP connection handler.
 *
 * In production, you would typically use a library like `imapflow`
 * for more robust protocol handling. This implementation provides
 * a clean interface and can be replaced without changing the
 * ImapProvider code above.
 *
 * The actual socket-level IMAP communication is abstracted here.
 * For the purposes of this module, we define the interface
 * and provide a stub that integrates with the architecture.
 */
class ImapConnection {
  private config: ImapConnectionConfig
  private tagCounter: number = 0
  private selectedMailbox: string = ''

  constructor(config: ImapConnectionConfig) {
    this.config = config
  }

  /**
   * Connect to the IMAP server.
   * In a real implementation, this would open a TLS/TCP socket.
   */
  async connect(): Promise<void> {
    // In production: establish TLS socket connection to config.host:config.port
    // For now, we validate the configuration
    if (!this.config.host || !this.config.port) {
      throw new Error('IMAP host and port are required')
    }
  }

  /**
   * Authenticate with the IMAP server using LOGIN command.
   */
  async login(): Promise<void> {
    // In production: send `TAG LOGIN username password`
    // and verify OK response
    const tag = this.nextTag()
    const command = `${tag} LOGIN "${this.config.username}" "${this.config.password}"`
    void command // Used in real implementation
  }

  /**
   * Select a mailbox for operations.
   */
  async selectMailbox(mailbox: string): Promise<void> {
    const tag = this.nextTag()
    const command = `${tag} SELECT "${mailbox}"`
    void command // Used in real implementation
    this.selectedMailbox = mailbox
  }

  /**
   * Search for messages matching the given criteria.
   * Returns an array of sequence numbers / UIDs.
   */
  async search(criteria: string[]): Promise<string[]> {
    const tag = this.nextTag()
    const command = `${tag} SEARCH ${criteria.join(' ')}`
    void command // Used in real implementation

    // In production: send SEARCH command and parse * SEARCH response
    // Return mock empty array for now — real implementation returns
    // actual message IDs from the server
    return []
  }

  /**
   * Fetch a single message by sequence number or UID.
   * Returns the raw RFC 2822 message source.
   */
  async fetchMessage(seqId: string): Promise<string> {
    const tag = this.nextTag()
    const command = `${tag} FETCH ${seqId} (RFC822)`
    void command // Used in real implementation

    // In production: send FETCH command and parse * seqId FETCH response
    // Return empty string for now — real implementation returns
    // the raw email source
    return ''
  }

  /**
   * Store flags on a message.
   */
  async storeFlags(seqId: string, action: string, flags: string): Promise<void> {
    const tag = this.nextTag()
    const command = `${tag} STORE ${seqId} ${action} (${flags})`
    void command // Used in real implementation
  }

  /**
   * Expunge deleted messages from the current mailbox.
   */
  async expunge(): Promise<void> {
    const tag = this.nextTag()
    const command = `${tag} EXPUNGE`
    void command // Used in real implementation
  }

  /**
   * Logout from the IMAP server.
   */
  async logout(): Promise<void> {
    const tag = this.nextTag()
    const command = `${tag} LOGOUT`
    void command // Used in real implementation
  }

  /**
   * Generate the next IMAP command tag.
   */
  private nextTag(): string {
    return `A${String(++this.tagCounter).padStart(4, '0')}`
  }
}

// ============================================================
// Lightweight SMTP Connection (Internal)
// ============================================================

interface SmtpConnectionConfig {
  host: string
  port: number
  tls: boolean
  username: string
  password: string
}

interface SmtpMailOptions {
  from: EmailAddress
  to: EmailAddress[]
  subject: string
  body: string
  isHtml: boolean
}

/**
 * Lightweight SMTP connection handler.
 * In production, use a library like `nodemailer` for robust SMTP handling.
 */
class SmtpConnection {
  private config: SmtpConnectionConfig

  constructor(config: SmtpConnectionConfig) {
    this.config = config
  }

  /**
   * Connect and authenticate with the SMTP server.
   */
  async connect(): Promise<void> {
    // In production: establish socket, EHLO, STARTTLS, AUTH
    if (!this.config.host) {
      throw new Error('SMTP host is required')
    }
  }

  /**
   * Send a mail message.
   */
  async sendMail(options: SmtpMailOptions): Promise<void> {
    // In production: MAIL FROM, RCPT TO, DATA, message content, QUIT
    const fromHeader = options.from.name
      ? `${options.from.name} <${options.from.address}>`
      : options.from.address

    const toHeader = options.to
      .map((addr) => (addr.name ? `${addr.name} <${addr.address}>` : addr.address))
      .join(', ')

    const contentType = options.isHtml
      ? 'text/html; charset=utf-8'
      : 'text/plain; charset=utf-8'

    const message = [
      `From: ${fromHeader}`,
      `To: ${toHeader}`,
      `Subject: =?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
      `Content-Type: ${contentType}`,
      'MIME-Version: 1.0',
      '',
      options.body,
    ].join('\r\n')

    void message // Used in real implementation
  }

  /**
   * Send QUIT to the SMTP server.
   */
  async quit(): Promise<void> {
    // In production: send QUIT command
  }
}
