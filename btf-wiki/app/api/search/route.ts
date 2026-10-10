import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// The default search index is local and needs no external API key.
export const { GET } = createFromSource(source, { language: 'english' });
