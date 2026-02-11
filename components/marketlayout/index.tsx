import { observer } from "mobx-react-lite";
import { useStore } from "../../mobx";
import { useEffect, useState, useCallback, ChangeEvent } from "react";
import Card from "../nftcard";
import LoadingCard from "./loadingcard";

const MarketLayout = () => {
  const store = useStore();
  const [isLoading, setLoading] = useState(true);
  const nfts: IMarketNftWithMetadata[] = store.marketNftWithMetadata;

  const fetchData = useCallback(() => {
    if (store.addressConfigLoaded && !store.contractsReady) {
      setLoading(false);
      return;
    }
    setLoading(true);
    store.fetchGLobalNftByPage().then(() => setLoading(false));
  }, [store, store.addressConfigLoaded, store.contractsReady]);

  const sortOrderhandler = (e: ChangeEvent<HTMLSelectElement>) => {
    const newOrder = parseInt(e.target.value);
    if (newOrder != store.sortOrder) {
      store.sortOrder = newOrder;
      fetchData();
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData, store.page]);

  if (store.addressConfigLoaded && !store.contractsReady) {
    return (
      <div className="pt-5">
        <div className="arena-panel-strong p-6 text-sm text-whiteish">
          Marketplace contracts not configured. Missing:{' '}
          {store.missingContracts.join(', ')}
        </div>
      </div>
    );
  }

  const cards = nfts.map((nft: IMarketNftWithMetadata) => (
    <Card shellRunner={nft} key={nft.tokenId} />
  ));

  const dummyCards = [...Array(6)].map((_, index) => (
    <LoadingCard key={index} />
  ));

  return (
    <div className="pt-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="arena-caption">Sort By</div>
        <select
          className="arena-panel bg-transparent px-3 py-2 text-sm text-whiteish"
          value={store.sortOrder}
          onChange={sortOrderhandler}
        >
          <option value="0">price low to high</option>
          <option value="1">price high to low</option>
          <option value="2">latest first</option>
          <option value="3">oldest first</option>
        </select>
      </div>
      <div className="h-full pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? dummyCards : cards}
      </div>
      <div className="flex justify-center items-center pt-6 gap-2 text-sm">
        <button
          onClick={() => store.page--}
          className="arena-button arena-button-ghost text-sm"
        >
          Previous
        </button>
        <button
          onClick={() => store.page++}
          className="arena-button arena-button-primary text-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default observer(MarketLayout);
