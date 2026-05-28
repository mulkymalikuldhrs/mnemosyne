export default function ApiDocsPage() {
  return (
    <html lang="en">
      <head>
        <title>Nanggroe IoT API Documentation</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      </head>
      <body style={{ margin: 0 }}>
        <div id="swagger-ui" />
        <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" />
        <script dangerouslySetInnerHTML={{__html: `
          SwaggerUIBundle({ url: '/api/docs', dom_id: '#swagger-ui' })
        `}} />
      </body>
    </html>
  )
}
