// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '@/components/forms/field';
import { StatusBadge } from '@/components/requests/badges';
import { RequestsTable } from '@/components/requests/requests-table';
import type { RequestDTO } from '@/lib/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const request: RequestDTO = {
  id: 'r1',
  title: 'Fix the footer',
  description: '',
  status: 'OPEN',
  priority: 'HIGH',
  dueDate: '2000-01-01T00:00:00.000Z',
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
  assignee: null,
  project: { id: 'p1', name: 'Website' },
  commentCount: 2,
};

afterEach(() => vi.unstubAllGlobals());

describe('Field', () => {
  it('associates label, hint and errors with the input', () => {
    render(<Field name="email" label="Email" hint="Work address" errors={['Required']} />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('field-email-error');
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('renders a readable label', () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });
});

describe('RequestsTable', () => {
  const props = {
    orgSlug: 'acme',
    initial: [request],
    initialCursor: null,
    query: '',
    showProject: true,
  };

  it('is read-only for viewers: no status select, overdue announced', () => {
    render(<RequestsTable {...props} canEdit={false} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('(overdue)')).toBeInTheDocument();
    expect(screen.getByText('comments')).toBeInTheDocument();
  });

  it('updates status optimistically and rolls back on error', async () => {
    let resolve: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    );
    render(<RequestsTable {...props} canEdit />);
    const select = screen.getByRole<HTMLSelectElement>('combobox', {
      name: 'Status of Fix the footer',
    });

    fireEvent.change(select, { target: { value: 'DONE' } });
    await waitFor(() => expect(select.value).toBe('DONE')); // optimistic
    resolve(
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Nope' } }), {
        status: 403,
      }),
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Nope'));
    expect(select.value).toBe('OPEN'); // rolled back
  });

  it('loads the next page with the cursor', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ data: [{ ...request, id: 'r2', title: 'Second' }], nextCursor: null }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<RequestsTable {...props} initialCursor="r1" query="status=OPEN" canEdit={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Second');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/orgs/acme/requests?status=OPEN&cursor=r1',
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
