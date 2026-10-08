import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrgContext } from '@/server/services/context';

// Pure service-logic tests: repositories are mocked, so no database is touched.
vi.mock('@/server/repos/requests.repo', () => ({
  findRequest: vi.fn(),
  createRequest: vi.fn(),
  updateRequest: vi.fn(),
  deleteRequest: vi.fn(),
  listRequests: vi.fn(() => Promise.resolve({ items: [], nextCursor: null })),
  countRequestsByStatus: vi.fn(),
}));
vi.mock('@/server/repos/comments.repo', () => ({
  findComment: vi.fn(),
  deleteComment: vi.fn(),
  createComment: vi.fn(),
  listComments: vi.fn(),
}));
vi.mock('@/server/repos/projects.repo', () => ({ findProject: vi.fn() }));
vi.mock('@/server/repos/memberships.repo', () => ({ findMembership: vi.fn() }));
vi.mock('@/server/repos/audit.repo', () => ({
  appendAuditLog: vi.fn(),
  toAuditJson: (v: unknown) => v,
}));
vi.mock('@/server/repos/transaction', () => ({
  transaction: (fn: (tx: object) => unknown) => fn({}),
}));

const requestsRepo = await import('@/server/repos/requests.repo');
const commentsRepo = await import('@/server/repos/comments.repo');
const projectsRepo = await import('@/server/repos/projects.repo');
const membershipsRepo = await import('@/server/repos/memberships.repo');
const requests = await import('@/server/services/requests.service');
const comments = await import('@/server/services/comments.service');

const ctx = (role: OrgContext['membership']['role']): OrgContext => ({
  user: { id: 'u1', email: 'u1@test.dev', name: 'U1' },
  org: { id: 'org1', slug: 'org1', name: 'Org', plan: 'FREE' },
  membership: { id: 'm1', role },
});

beforeEach(() => vi.clearAllMocks());

describe('requests.service (mocked repos)', () => {
  it('checks permission before touching any repository', async () => {
    await expect(
      requests.createRequest(ctx('VIEWER'), { projectId: 'p1', title: 'x' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(requests.deleteRequest(ctx('VIEWER'), 'r1')).rejects.toMatchObject({
      status: 403,
    });
    expect(projectsRepo.findProject).not.toHaveBeenCalled();
    expect(requestsRepo.deleteRequest).not.toHaveBeenCalled();
  });

  it('always scopes repository calls to the context org', async () => {
    await requests.listRequests(ctx('VIEWER'), { assignee: 'me' });
    expect(requestsRepo.listRequests).toHaveBeenCalledWith(
      'org1',
      expect.objectContaining({ assigneeId: 'u1' }),
      { limit: 20 },
    );
    await requests.listRequests(ctx('VIEWER'), { assignee: 'none' });
    expect(requestsRepo.listRequests).toHaveBeenLastCalledWith(
      'org1',
      expect.objectContaining({ assigneeId: null }),
      { limit: 20 },
    );
  });

  it('404s when the project is not in the org, 409 when archived', async () => {
    vi.mocked(projectsRepo.findProject).mockResolvedValueOnce(null);
    await expect(
      requests.createRequest(ctx('MEMBER'), { projectId: 'p1', title: 'x' }),
    ).rejects.toMatchObject({ status: 404 });
    vi.mocked(projectsRepo.findProject).mockResolvedValueOnce({
      id: 'p1',
      archivedAt: new Date(),
    } as never);
    await expect(
      requests.createRequest(ctx('MEMBER'), { projectId: 'p1', title: 'x' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects viewer assignees with 422', async () => {
    vi.mocked(projectsRepo.findProject).mockResolvedValueOnce({
      id: 'p1',
      archivedAt: null,
    } as never);
    vi.mocked(membershipsRepo.findMembership).mockResolvedValueOnce({ role: 'VIEWER' } as never);
    await expect(
      requests.createRequest(ctx('MEMBER'), { projectId: 'p1', title: 'x', assigneeId: 'u2' }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('comments.service (mocked repos)', () => {
  it('lets authors delete their own comment', async () => {
    vi.mocked(commentsRepo.findComment).mockResolvedValueOnce({
      id: 'c1',
      authorId: 'u1',
    } as never);
    await comments.deleteComment(ctx('MEMBER'), 'c1');
    expect(commentsRepo.deleteComment).toHaveBeenCalledWith('org1', 'c1');
  });

  it("blocks members from deleting others' comments, allows admins", async () => {
    vi.mocked(commentsRepo.findComment).mockResolvedValue({
      id: 'c1',
      authorId: 'someone-else',
    } as never);
    await expect(comments.deleteComment(ctx('MEMBER'), 'c1')).rejects.toMatchObject({
      status: 403,
    });
    await comments.deleteComment(ctx('ADMIN'), 'c1');
    expect(commentsRepo.deleteComment).toHaveBeenCalledTimes(1);
  });

  it('404s for unknown comments and requests', async () => {
    vi.mocked(commentsRepo.findComment).mockResolvedValueOnce(null);
    await expect(comments.deleteComment(ctx('OWNER'), 'nope')).rejects.toMatchObject({
      status: 404,
    });
    vi.mocked(requestsRepo.findRequest).mockResolvedValueOnce(null);
    await expect(comments.addComment(ctx('OWNER'), 'nope', { body: 'hi' })).rejects.toMatchObject({
      status: 404,
    });
  });
});
