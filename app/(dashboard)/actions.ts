'use server';

import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { toActionState } from '@/server/lib/action';
import { createOrganization } from '@/server/services/organizations.service';
import { requireUser } from '@/server/services/session';

export async function createOrgAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireUser();
    const org = await createOrganization({ userId: user.id, name: form.get('name') });
    slug = org.slug;
  } catch (err) {
    const state = toActionState(err);
    return {
      ...state,
      fieldErrors: state.fieldErrors?._ ? { name: state.fieldErrors._ } : state.fieldErrors,
    };
  }
  redirect(`/${slug}`);
}
