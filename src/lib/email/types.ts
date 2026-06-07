// ============================================================
// MNEMOSYNE v1.0.0 — Email Integration Type Definitions
// Universal AI/Human Memory Hub: Email Integration Layer
//
// Types, interfaces, and configuration for multi-provider
// email connectivity (Gmail, IMAP, Outlook).
// ============================================================

// --- Provider Types ---

/** Supported email provider backends */
export type EmailProvider = 'gmail' | 'imap' | 'outlook'

// --- Email Message ---

/** A normalized email message across all providers */
export interface EmailMessage {
  /** Internal database ID (cuid) */
  id: string
  /** RFC 2822 Message-ID header (provider-unique) */
  messageId: string
  /** Sender address and display name */
  from: EmailAddress
  /** Recipient addresses */
  to: EmailAddress[]
  /** Email subject line */
  subject: string
  /** Plain-text body */
  bodyText: string
  /** HTML body (may be empty if only text available) */
  bodyHtml: string
  /** Date from the email header */
  date: Date
  /** Whether the email has been read */
  isRead: boolean
  /** Whether the email is starred/flagged */
  isStarred: boolean
  /** Provider-specific label/tag strings */
  labels: string[]
}

/** Structured email address with optional display name */
export interface EmailAddress {
  address: string
  name?: string
}

// --- Email Account Configuration ---

/** Configuration needed to connect an email account */
export interface EmailAccountConfig {
  /** Provider type */
  provider: EmailProvider
  /** Account email address */
  emailAddress: string
  /** Display name for the account */
  displayName?: string

  // --- OAuth2 fields (Gmail / Outlook) ---
  /** OAuth2 access token */
  accessToken?: string
  /** OAuth2 refresh token */
  refreshToken?: string
  /** OAuth2 client ID */
  clientId?: string
  /** OAuth2 client secret */
  clientSecret?: string
  /** OAuth2 redirect URI */
  redirectUri?: string

  // --- IMAP/SMTP fields ---
  /** IMAP server hostname */
  imapHost?: string
  /** IMAP server port (default 993) */
  imapPort?: number
  /** SMTP server hostname */
  smtpHost?: string
  /** SMTP server port (default 587) */
  smtpPort?: number
  /** Username for IMAP/SMTP auth (defaults to emailAddress) */
  username?: string
  /** Password or app-specific password for IMAP/SMTP */
  password?: string
  /** Use TLS for IMAP (default true) */
  imapTls?: boolean
  /** Use TLS for SMTP (default true) */
  smtpTls?: boolean
}

// --- Listing / Search Options ---

/** Options for listing email messages */
export interface EmailListOptions {
  /** Maximum number of messages to return per page */
  limit?: number
  /** Pagination cursor / page token */
  pageToken?: string
  /** Only return messages newer than this date */
  afterDate?: Date
  /** Only return messages older than this date */
  beforeDate?: Date
  /** Filter by label / folder */
  label?: string
  /** Include only unread messages */
  unreadOnly?: boolean
}

/** Paginated result of email listing */
export interface EmailListResult {
  messages: EmailMessage[]
  /** Token to fetch the next page, or null if no more pages */
  nextPageToken: string | null
  /** Total estimated result count (provider may not always supply this) */
  totalEstimate?: number
}

/** Options for AI-powered email summarisation */
export interface EmailSummarizeOptions {
  /** Maximum number of emails to include in the summary */
  limit?: number
  /** Only summarise emails newer than this date */
  afterDate?: Date
  /** Only summarise emails from these senders */
  fromAddresses?: string[]
  /** Only summarise emails with these labels */
  labels?: string[]
  /** Custom system prompt appended to the summariser */
  customPrompt?: string
}

// --- Provider Interface ---

/**
 * Unified interface that every email provider must implement.
 * This allows the EmailManager to orchestrate Gmail, IMAP,
 * and Outlook providers interchangeably.
 */
export interface EmailProviderInterface {
  /** The provider type identifier */
  readonly providerType: EmailProvider

  /**
   * Authenticate with the email provider.
   * For OAuth2 providers, this validates / refreshes tokens.
   * For IMAP, this establishes the connection.
   *
   * @param credentials - Provider-specific credentials
   * @throws {EmailProviderError} If authentication fails
   */
  authenticate(credentials: EmailAccountConfig): Promise<void>

  /**
   * List email messages from the provider.
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of email messages
   */
  listMessages(options?: EmailListOptions): Promise<EmailListResult>

  /**
   * Get a single email message by its Message-ID.
   *
   * @param messageId - The RFC 2822 Message-ID to look up
   * @returns The full email message
   * @throws {EmailProviderError} If the message is not found
   */
  getMessage(messageId: string): Promise<EmailMessage>

  /**
   * Search emails by a free-text query.
   * Providers translate the query to their native search syntax.
   *
   * @param query - Free-text search query
   * @returns Matching email messages
   */
  searchMessages(query: string): Promise<EmailMessage[]>

  /**
   * Send an email message.
   *
   * @param to - Recipient addresses
   * @param subject - Email subject
   * @param body - Email body (plain text or HTML)
   * @param isHtml - Whether the body is HTML (default false)
   */
  sendMessage(to: EmailAddress[], subject: string, body: string, isHtml?: boolean): Promise<void>

  /**
   * Mark an email as read.
   *
   * @param messageId - The Message-ID to mark as read
   */
  markAsRead(messageId: string): Promise<void>

  /**
   * Delete an email message.
   *
   * @param messageId - The Message-ID to delete
   */
  deleteMessage(messageId: string): Promise<void>

  /**
   * Disconnect and release any resources.
   */
  disconnect(): Promise<void>
}

// --- Error Types ---

/** Custom error class for email provider operations */
export class EmailProviderError extends Error {
  /** The provider that raised the error */
  public readonly provider: EmailProvider
  /** Machine-readable error code */
  public readonly code: EmailErrorCode
  /** Original error (if any) */
  public readonly cause?: unknown

  constructor(
    provider: EmailProvider,
    code: EmailErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message)
    this.name = 'EmailProviderError'
    this.provider = provider
    this.code = code
    this.cause = cause
  }
}

/** Machine-readable error codes for email provider errors */
export type EmailErrorCode =
  | 'AUTH_FAILED'
  | 'AUTH_EXPIRED'
  | 'CONNECTION_FAILED'
  | 'RATE_LIMITED'
  | 'MESSAGE_NOT_FOUND'
  | 'SEND_FAILED'
  | 'SEARCH_FAILED'
  | 'PROTOCOL_ERROR'
  | 'NETWORK_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'UNKNOWN_ERROR'

// --- Rate Limiter ---

/** Simple token-bucket rate limiter for API calls */
export class RateLimiter {
  private tokens: number
  private lastRefill: number

  constructor(
    private readonly maxTokens: number,
    private readonly refillIntervalMs: number
  ) {
    this.tokens = maxTokens
    this.lastRefill = Date.now()
  }

  /** Wait until a token is available, then consume it */
  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens > 0) {
      this.tokens--
      return
    }
    // Wait for the next refill and retry
    await new Promise((resolve) => setTimeout(resolve, this.refillIntervalMs))
    this.refill()
    this.tokens--
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const tokensToAdd = Math.floor(elapsed / this.refillIntervalMs)
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
      this.lastRefill = now
    }
  }
}
