import dynamic from 'next/dynamic';

export default dynamic(() => import('../../components/runtime/ShellRunnersRuntimeEntry'), {
  ssr: false,
});
