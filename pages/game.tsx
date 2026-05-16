function buildRedirectDestination(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else if (typeof value === 'string') {
      params.set(key, value);
    }
  });
  const qs = params.toString();
  return qs ? `/shellrunners?${qs}` : '/shellrunners';
}

export async function getServerSideProps(ctx: { query: Record<string, string | string[] | undefined> }) {
  return {
    redirect: {
      destination: buildRedirectDestination(ctx.query),
      permanent: false,
    },
  };
}

export default function LegacyGameRedirect() {
  return null;
}
