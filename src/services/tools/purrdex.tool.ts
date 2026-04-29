import { prisma } from '../../lib/prisma.js';

export class PurrdexTool {
	/**
	 * Search for Purrdex entries by title, content, or tags
	 */
	async searchEntries(args: {
		query: string;
		category?: string;
		tags?: string[];
		limit?: number;
		status?: string;
	}) {
		try {
			const { query, category, tags, limit = 10, status = 'Published' } = args;

			const entries = await prisma.purrdexEntry.findMany({
				where: {
					AND: [
						status ? { status } : {},
						category ? { category } : {},
						tags && tags.length > 0 ? { tags: { hasSome: tags } } : {},
						{
							OR: [
								{ title: { contains: query, mode: 'insensitive' } },
								{ summary: { contains: query, mode: 'insensitive' } },
								{ content: { contains: query, mode: 'insensitive' } }
							]
						}
					]
				},
				select: {
					id: true,
					documentId: true,
					title: true,
					slug: true,
					category: true,
					summary: true,
					tags: true,
					status: true,
					views: true,
					images: true,
					createdAt: true,
					publishedAt: true,
					BlogAuthor: {
						select: {
							name: true,
							username: true
						}
					}
				},
				orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
				take: Math.min(limit, 20)
			});

			if (entries.length === 0) {
				return {
					success: true,
					message: `No entries found matching "${query}"`,
					query,
					count: 0,
					entries: []
				};
			}

			return {
				success: true,
				message: `Found ${entries.length} Purrdex entries`,
				query,
				count: entries.length,
				entries: entries.map((entry) => ({
					id: entry.id,
					documentId: entry.documentId,
					title: entry.title,
					slug: entry.slug,
					category: entry.category,
					summary: entry.summary,
					tags: entry.tags,
					status: entry.status,
					views: entry.views,
					images: entry.images,
					author: entry.BlogAuthor.name,
					publishedAt: entry.publishedAt,
					createdAt: entry.createdAt
				}))
			};
		} catch (error) {
			console.error('[Purrdex] Search error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				message: 'Failed to search Purrdex entries',
				query: args.query
			};
		}
	}

	/**
	 * Get a specific Purrdex entry by ID or slug
	 */
	async getEntry(args: { identifier: string; incrementView?: boolean }) {
		try {
			const { identifier, incrementView = true } = args;
			const isNumeric = /^\d+$/.test(identifier);

			const entry = await prisma.purrdexEntry.findFirst({
				where: isNumeric ? { id: parseInt(identifier) } : { slug: identifier },
				include: {
					BlogAuthor: {
						select: {
							name: true,
							username: true,
							avatar: true,
							bio: true
						}
					},
					PurrdexCategory: {
						select: {
							name: true,
							description: true,
							icon: true
						}
					}
				}
			});

			if (!entry) {
				return {
					success: false,
					message: `Entry "${identifier}" not found`,
					identifier
				};
			}

			// Increment view count
			if (incrementView) {
				await prisma.purrdexEntry.update({
					where: { id: entry.id },
					data: { views: entry.views + 1 }
				});
			}

			return {
				success: true,
				message: `Retrieved entry: ${entry.title}`,
				entry: {
					id: entry.id,
					documentId: entry.documentId,
					title: entry.title,
					slug: entry.slug,
					category: entry.category,
					summary: entry.summary,
					content: entry.content,
					tags: entry.tags,
					images: entry.images,
					relatedEntries: entry.relatedEntries,
					status: entry.status,
					views: incrementView ? entry.views + 1 : entry.views,
					createdAt: entry.createdAt,
					updatedAt: entry.updatedAt,
					publishedAt: entry.publishedAt,
					author: {
						name: entry.BlogAuthor.name,
						username: entry.BlogAuthor.username,
						avatar: entry.BlogAuthor.avatar,
						bio: entry.BlogAuthor.bio
					},
					categoryInfo: {
						name: entry.PurrdexCategory.name,
						description: entry.PurrdexCategory.description,
						icon: entry.PurrdexCategory.icon
					}
				}
			};
		} catch (error) {
			console.error('[Purrdex] Get entry error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				message: 'Failed to retrieve Purrdex entry',
				identifier: args.identifier
			};
		}
	}

	/**
	 * Create a new Purrdex entry (always authored by Quin)
	 */
	async createEntry(args: {
		title: string;
		summary: string;
		content: string;
		category: string;
		tags?: string[];
		images?: string[];
		relatedEntries?: string[];
		status?: string;
	}) {
		try {
			const {
				title,
				summary,
				content,
				category,
				tags = [],
				images = [],
				relatedEntries = [],
				status = 'Published'
			} = args;

			// Generate a slug from the title
			const slug = title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');

			// Get Quin's author ID
			const quinAuthor = await prisma.blogAuthor.findFirst({
				where: {
					OR: [{ username: 'quin' }, { uid: 'quin' }]
				}
			});

			if (!quinAuthor) {
				return {
					success: false,
					message:
						'Quin author profile not found. Please create an author with username or uid "quin" first.'
				};
			}

			const authorId = quinAuthor.id;

			// Check if category exists, create if it doesn't
			let categoryExists = await prisma.purrdexCategory.findUnique({
				where: { name: category }
			});

			if (!categoryExists) {
				// Auto-create the category
				const categorySlug = category
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-|-$/g, '');

				categoryExists = await prisma.purrdexCategory.create({
					data: {
						documentId: `category-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
						name: category,
						slug: categorySlug,
						description: `Auto-generated category for ${category}`,
						updatedAt: new Date()
					}
				});
			}

			const entry = await prisma.purrdexEntry.create({
				data: {
					documentId: `purrdex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
					title,
					slug,
					category,
					summary,
					content,
					tags,
					images,
					relatedEntries,
					authorId,
					status,
					publishedAt: status === 'Published' ? new Date() : null,
					updatedAt: new Date()
				},
				include: {
					BlogAuthor: {
						select: {
							name: true,
							username: true
						}
					},
					PurrdexCategory: {
						select: {
							name: true,
							description: true
						}
					}
				}
			});

			// Create audit log
			await prisma.purrdexAuditLog.create({
				data: {
					entryId: entry.id,
					action: 'CREATE',
					performedById: authorId,
					newValues: JSON.stringify({ title, summary, category, status })
				}
			});

			await prisma.purrdexAuditLog.create({
				data: {
					entryId: entry.id,
					action: 'PUBLISHED',
					performedById: authorId,
					newValues: JSON.stringify({ title, summary, category, status })
				}
			});

			return {
				success: true,
				message: `✨ Created Purrdex entry: "${title}"`,
				entry: {
					id: entry.id,
					documentId: entry.documentId,
					title: entry.title,
					slug: entry.slug,
					category: entry.category,
					summary: entry.summary,
					status: entry.status,
					author: entry.BlogAuthor.name,
					createdAt: entry.createdAt
				}
			};
		} catch (error) {
			console.error('[Purrdex] Create entry error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				message: 'Failed to create Purrdex entry'
			};
		}
	}

	/**
	 * List all available categories
	 */
	async listCategories() {
		try {
			const categories = await prisma.purrdexCategory.findMany({
				select: {
					id: true,
					name: true,
					slug: true,
					description: true,
					icon: true,
					_count: {
						select: {
							PurrdexEntry: true
						}
					}
				},
				orderBy: {
					name: 'asc'
				}
			});

			return {
				success: true,
				message: `Found ${categories.length} categories`,
				count: categories.length,
				categories: categories.map((cat) => ({
					id: cat.id,
					name: cat.name,
					slug: cat.slug,
					description: cat.description,
					icon: cat.icon,
					entryCount: cat._count.PurrdexEntry
				}))
			};
		} catch (error) {
			console.error('[Purrdex] List categories error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				message: 'Failed to list categories'
			};
		}
	}

	/**
	 * Get recent or popular Purrdex entries
	 */
	async listEntries(args: {
		category?: string;
		orderBy?: 'recent' | 'popular' | 'views';
		limit?: number;
		status?: string;
	}) {
		try {
			const { category, orderBy = 'recent', limit = 10, status = 'Published' } = args;

			const entries = await prisma.purrdexEntry.findMany({
				where: {
					AND: [status ? { status } : {}, category ? { category } : {}]
				},
				select: {
					id: true,
					documentId: true,
					title: true,
					slug: true,
					category: true,
					summary: true,
					tags: true,
					status: true,
					views: true,
					images: true,
					publishedAt: true,
					createdAt: true,
					BlogAuthor: {
						select: {
							name: true,
							username: true
						}
					}
				},
				orderBy:
					orderBy === 'popular' || orderBy === 'views'
						? { views: 'desc' }
						: { publishedAt: 'desc' },
				take: Math.min(limit, 20)
			});

			return {
				success: true,
				message: `Found ${entries.length} Purrdex entries`,
				count: entries.length,
				orderBy,
				entries: entries.map((entry) => ({
					id: entry.id,
					documentId: entry.documentId,
					title: entry.title,
					slug: entry.slug,
					category: entry.category,
					summary: entry.summary,
					tags: entry.tags,
					status: entry.status,
					views: entry.views,
					images: entry.images,
					author: entry.BlogAuthor.name,
					publishedAt: entry.publishedAt,
					createdAt: entry.createdAt
				}))
			};
		} catch (error) {
			console.error('[Purrdex] List entries error:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				message: 'Failed to list Purrdex entries'
			};
		}
	}
}
