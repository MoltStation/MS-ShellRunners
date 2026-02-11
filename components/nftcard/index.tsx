import Image from 'next/image';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../mobx';
import { useCallback, useState } from 'react';

function useHover() {
  const [hovering, setHovering] = useState(false);
  const onHoverProps = {
    onMouseEnter: () => setHovering(true),
    onMouseLeave: () => setHovering(false),
  };
  return [hovering, onHoverProps];
}

const Card = ({ shellRunner }: { shellRunner: IMarketNftWithMetadata }) => {
  const state = useStore();
  const [isHover, hoverProps] = useHover();

  const purchaseHandler = useCallback(() => {
    state.purchaseShellRunner(shellRunner.itemId, shellRunner.price);
  }, [state, shellRunner]);

  const buttonText = isHover
    ? shellRunner.owner === state.accountAddress
      ? 'Owned'
      : 'Purchase'
    : `${shellRunner.price} ETH`;
  const attributes = shellRunner.metadata?.attributes ?? [];

  return (
    <div className='arena-panel w-full max-w-xs p-4 text-left font-primary'>
      <div className='flex items-center gap-3'>
        <Image
          className='rounded-full border arena-border-soft'
          src='/assets/website/avtar.webp'
          alt='avtar'
          height={40}
          width={40}
        />
        <div>
          <div className='text-base font-semibold text-whiteish'>
            {shellRunner.metadata.name}
          </div>
          <div className='arena-text-muted text-xs uppercase tracking-[0.2em]'>
            {shellRunner.collectionLabel ?? 'Collection'}
          </div>
        </div>
      </div>
      <div className='arena-panel-strong mt-4 flex flex-col items-center gap-3 p-4'>
        <Image
          className='rounded-2xl'
          src={shellRunner.metadata.image}
          blurDataURL='/assets/ShellRunnerPlaceholder.png'
          placeholder='blur'
          alt='placeholder'
          width={220}
          height={240}
        />
        <button
          className='arena-button arena-button-primary text-sm'
          onClick={purchaseHandler}
          {...hoverProps}>
          {buttonText}
        </button>
      </div>
      {attributes.length > 0 && (
        <div className='mt-4 flex flex-wrap gap-2 text-xs'>
          {attributes.map((attr) => (
            <div
              className='rounded-full border arena-border-soft px-3 py-1 arena-text-dim'
              key={attr.trait_type}>
              {attr.trait_type}: {attr.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default observer(Card);
