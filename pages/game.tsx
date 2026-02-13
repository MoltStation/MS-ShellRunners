export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/shellrunners',
      permanent: false,
    },
  };
}

export default function LegacyGameRedirect() {
  return null;
}
