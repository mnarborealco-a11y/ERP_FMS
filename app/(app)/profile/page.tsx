'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { Button, Card, ErrorBanner, Field, Input, PageHeader } from '@/components/ui';

export default function ProfilePage() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccess(true);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Profile" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Account</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{user?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-900">{user?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Role</dt>
              <dd className="font-medium text-slate-900">{user?.role === 'FOUNDER_ADMIN' ? 'Founder / Admin' : 'User'}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Change Password</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field label="New password (min 8 characters)">
              <Input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </Field>
            {error && <ErrorBanner message={error} />}
            {success && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Password updated.</div>}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
