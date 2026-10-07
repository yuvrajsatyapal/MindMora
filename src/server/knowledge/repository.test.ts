import { expect,it,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import {escapePrefix,searchQueryKey,createKnowledgeRepository} from './repository';
import type {getDatabase} from '../db/client';
import type {VerifiedOwner} from '../db/user-context';
it('escapes literal LIKE patterns and fingerprints normalized filters',()=>{expect(escapePrefix('a%_\\')).toBe('a\\%\\_\\\\%');expect(searchQueryKey(' A ', 'ÉTÉ')).toBe(searchQueryKey('a','été'));expect(searchQueryKey('a','été')).not.toBe(searchQueryKey('a','other'));});
it('preserves safe not-found after the checked transaction returns',async()=>{
 const database={run:vi.fn(async(_owner,fn)=>fn({execute:async()=>[]})),close:vi.fn()} as unknown as ReturnType<typeof getDatabase>;
 const repository=createKnowledgeRepository(database);
 await expect(repository.backlinks({userId:'fixture'} as VerifiedOwner,'fixture',{limit:20})).rejects.toMatchObject({code:'not_found'});
});
