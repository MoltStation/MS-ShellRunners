import Image from 'next/image';

function DummyCard() {
  return (
    <div className='arena-panel w-72 p-4 font-primary'>
      <div className='text-xl'>
        <h5 className='text-left text-2xl text-whiteish'>Shell Runner name</h5>
        <div className='flex flex-col'>
          <h6 className='text-sm text-left py-1 arena-text-muted'>
            User image
          </h6>
        </div>
      </div>
      <div className='arena-panel-strong mt-4 flex flex-col items-center gap-3 p-4'>
        <Image
          className='rounded-2xl'
          src='/assets/ShellRunnerPlaceholder.png'
          alt='placeholder'
          width={220}
          height={240}
        />
        <button className='arena-button arena-button-ghost text-sm'>
          logo Price ETH
        </button>
      </div>
      <div className='mt-4 flex flex-wrap gap-2 text-xs'>
        <div className='rounded-full border arena-border-soft px-3 py-1 arena-text-dim'>
          Attribute 1
        </div>
        <div className='rounded-full border arena-border-soft px-3 py-1 arena-text-dim'>
          Attribute 2
        </div>
        <div className='rounded-full border arena-border-soft px-3 py-1 arena-text-dim'>
          Attribute 3
        </div>
        <div className='rounded-full border arena-border-soft px-3 py-1 arena-text-dim'>
          Attribute 4
        </div>
      </div>
    </div>
  );
}

export default DummyCard;
