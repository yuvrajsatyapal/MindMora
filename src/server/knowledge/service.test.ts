import {expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createKnowledgeService} from './service';
import type {KnowledgeRepository} from './repository';
it('rejects malformed repository projections as service failures',async()=>{
 const repo={tags:vi.fn(async()=>({items:[{key:'tag',displayName:'tag',noteCount:-1}],nextCursor:null}))} as unknown as KnowledgeRepository;
 await expect(createKnowledgeService(repo).tags({userId:'fixture'},{limit:20})).rejects.toMatchObject({code:'service_unavailable'});
});
