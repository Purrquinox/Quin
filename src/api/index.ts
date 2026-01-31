import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { chatRoutes } from './routes/chat.routes.js';
// import { conversationRoutes } from './routes/conversation.routes.js';
// import { userRoutes } from './routes/user.routes.js';
import { createMiddleware } from 'hono/factory';
import { encode } from 'cbor2';

declare module 'hono' {
	interface ContextRenderer {
		(content: any): Response | Promise<Response>;
	}
}

function toArrayBuffer(data: ArrayBuffer | SharedArrayBuffer | Uint8Array): ArrayBuffer {
	if (data instanceof ArrayBuffer) {
		return data;
	}

	if (data instanceof Uint8Array) {
		return data.buffer instanceof ArrayBuffer ? data.buffer : data.slice().buffer;
	}

	// SharedArrayBuffer → ArrayBuffer (explicit copy)
	return new Uint8Array(data).slice().buffer;
}

const cborMiddleware = createMiddleware(async (c, next) => {
	const accept = c.req.header('accept') ?? '';

	if (accept.includes('application/cbor')) {
		c.setRenderer((content) => {
			const encoded = encode(content);
			const buffer = toArrayBuffer(encoded);

			return new Response(new Blob([buffer], { type: 'application/cbor' }), {
				headers: {
					'Content-Type': 'application/cbor',
					Vary: 'Accept'
				}
			});
		});
	}

	await next();
});

export function createAPI() {
	const app = new OpenAPIHono();
	app.use('/api/*', cborMiddleware);

	// Health check
	app.get('/health', (c) => c.render({ status: 'ok', timestamp: new Date().toISOString() }));

	// API routes
	app.route('/api/chat', chatRoutes);
	// app.route('/api/conversations', conversationRoutes);
	// app.route('/api/users', userRoutes);

	// OpenAPI docs
	app.doc('/openapi.json', {
		openapi: '3.0.0',
		info: {
			version: '1.0.0',
			title: 'Quin AI API',
			description:
				'API for Quin AI assistant - a platform-agnostic conversational AI with memory, internet search, and social media integration'
		},
		servers: [{ url: 'http://localhost:3000', description: 'Development server' }]
	});

	// Swagger UI
	app.get('/docs', swaggerUI({ url: '/openapi.json' }));

	return app;
}
