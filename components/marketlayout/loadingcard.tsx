const LoadingCard = () => {
  return (
    <div className='arena-panel rounded-2xl p-4 space-y-4 flex flex-col w-full'>
      <div className='flex justify-start items-center gap-3 w-full'>
        <div className='bg-black/30 animate-pulse p-6 rounded-full'></div>
        <div className='space-y-2 flex-grow'>
          <div className='bg-black/30 animate-pulse w-2/3 py-2 rounded-lg'></div>
          <div className='bg-black/30 animate-pulse w-2/5 py-2 rounded-lg'></div>
        </div>
      </div>
      <div className='bg-black/30 animate-pulse py-28 w-full rounded-2xl'></div>
      <div className='flex justify-center items-center'>
        <div className='bg-black/30 animate-pulse py-3 w-1/3 rounded-full'></div>
      </div>
    </div>
  );
};

export default LoadingCard;
