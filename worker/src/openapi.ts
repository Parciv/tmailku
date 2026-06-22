// Spec OpenAPI minimal + halaman /docs (Scalar via CDN).
export const openapiSpec = {
	openapi: '3.0.3',
	info: {
		title: 'TMailku API',
		version: '1.0.0',
		description:
			'API publik TMailku. Semua endpoint /api/v1/* WAJIB header `Authorization: Bearer <API_KEY>`. Dapatkan API key dari admin dashboard.',
	},
	servers: [{ url: '/' }],
	components: {
		securitySchemes: {
			bearerAuth: { type: 'http', scheme: 'bearer' },
		},
	},
	security: [{ bearerAuth: [] }],
	paths: {
		'/api/v1/address': {
			post: {
				summary: 'Generate alamat temporary',
				requestBody: {
					required: false,
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									domain: { type: 'string', description: 'Domain tujuan (opsional)' },
									local: { type: 'string', description: 'Local-part custom (opsional)' },
									ttlMinutes: { type: 'number' },
								},
							},
						},
					},
				},
				responses: { '200': { description: 'Alamat dibuat' } },
			},
		},
		'/api/v1/inbox/{addr}': {
			get: {
				summary: 'Ambil daftar email pada alamat',
				parameters: [{ name: 'addr', in: 'path', required: true, schema: { type: 'string' } }],
				responses: { '200': { description: 'Daftar email' } },
			},
		},
		'/api/v1/email/{id}': {
			get: {
				summary: 'Detail email',
				parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
				responses: { '200': { description: 'Detail email' } },
			},
		},
	},
}

export const docsHtml = `<!doctype html>
<html>
  <head>
    <title>TMailku API Docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`
