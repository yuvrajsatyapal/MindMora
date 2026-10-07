import 'server-only';
import type { z } from 'zod';
import { HttpFailure } from '../http/errors';
import { createKnowledgeRepository, type KnowledgeRepository } from './repository';
import { targetPageSchema,resolutionPageSchema,backlinksPageSchema,tagPageSchema,searchPageSchema } from '../../features/knowledge/types';
function validate<T>(schema:z.ZodType<T>,value:unknown):T { const result=schema.safeParse(value);if(!result.success)throw new HttpFailure('service_unavailable');return result.data; }
export function createKnowledgeService(repository:KnowledgeRepository=createKnowledgeRepository()) {
 return {
  complete: async (...args:Parameters<KnowledgeRepository['complete']>)=>validate(targetPageSchema,await repository.complete(...args)),
  resolve: async (...args:Parameters<KnowledgeRepository['resolve']>)=>validate(resolutionPageSchema,await repository.resolve(...args)),
  backlinks: async (...args:Parameters<KnowledgeRepository['backlinks']>)=>validate(backlinksPageSchema,await repository.backlinks(...args)),
  tags: async (...args:Parameters<KnowledgeRepository['tags']>)=>validate(tagPageSchema,await repository.tags(...args)),
  search: async (...args:Parameters<KnowledgeRepository['search']>)=>validate(searchPageSchema,await repository.search(...args)),
 };
}
