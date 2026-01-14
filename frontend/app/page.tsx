import Dashboard from '../components/Dashboard';
import { ulid } from 'ulid';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} must be defined`);
  }
  return value;
}

const PUBLIC_API_BASE_URL = requireEnv(
  'NEXT_PUBLIC_API_BASE_URL',
  process.env.NEXT_PUBLIC_API_BASE_URL,
);

const INTERNAL_API_BASE_URL =
  process.env.NEXT_INTERNAL_API_BASE_URL ?? PUBLIC_API_BASE_URL;

const TENANT_ID = requireEnv('NEXT_PUBLIC_TENANT_ID', process.env.NEXT_PUBLIC_TENANT_ID);

async function fetchInitialEvents() {
  const requestId = ulid();
  const response = await fetch(`${INTERNAL_API_BASE_URL}/events?limit=50`, {
    headers: {
      'x-tenant-id': TENANT_ID,
      'x-request-id': requestId,
    },
    cache: 'no-store',
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error('Failed to load events');
  }
  return response.json();
}

export default async function HomePage() {
  const initial = await fetchInitialEvents();
  return (
    <main>
      <Dashboard
        initialEvents={initial.items ?? []}
        initialCursor={initial.cursor ?? null}
        tenantId={TENANT_ID}
        apiBaseUrl={PUBLIC_API_BASE_URL}
      />
    </main>
  );
}
