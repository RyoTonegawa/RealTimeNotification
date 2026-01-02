import Dashboard from '../components/Dashboard';

const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
const INTERNAL_API_BASE_URL =
  process.env.NEXT_INTERNAL_API_BASE_URL ?? PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? '11111111-1111-1111-1111-111111111111';

async function fetchInitialEvents() {
  const response = await fetch(`${INTERNAL_API_BASE_URL}/events?limit=50`, {
    headers: {
      'x-tenant-id': TENANT_ID,
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
