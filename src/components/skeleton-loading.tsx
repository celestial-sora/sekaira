import {ErrorNote} from './shared';

type Props={path:string;label:string;error:string;retryLabel:string;onRetry:()=>void};

export function SkeletonLoading({path,label,error,retryLabel,onRetry}:Props){
  if(error)return <div className="loading glass" role="alert"><ErrorNote message={error}/><button className="button" onClick={onRetry}>{retryLabel}</button></div>;
  const isCharacters=path==='/characters'||path.startsWith('/profile/');
  const isWorlds=path==='/worlds';
  const isDetail=path.startsWith('/characters/')||path.startsWith('/worlds/');
  return <div className="skeleton-page" role="status" aria-live="polite" aria-label={label}>
    <span className="skeleton-screen-reader">{label}</span>
    <div aria-hidden="true">
      {isDetail?<div className="skeleton-detail glass"><span className="skeleton-block skeleton-detail-art"/><div className="skeleton-detail-copy"><span className="skeleton-block skeleton-line short"/><span className="skeleton-block skeleton-line title"/><span className="skeleton-block skeleton-line"/><span className="skeleton-block skeleton-line medium"/><span className="skeleton-block skeleton-button"/></div></div>:<>
        {!isCharacters&&!isWorlds&&<div className="skeleton-hero glass"><span className="skeleton-block skeleton-line short"/><span className="skeleton-block skeleton-line title"/><span className="skeleton-block skeleton-line medium"/><span className="skeleton-block skeleton-button"/></div>}
        <div className="skeleton-heading"><span className="skeleton-block skeleton-line title"/><span className="skeleton-block skeleton-line medium"/></div>
        {(isCharacters||isWorlds)&&<div className="skeleton-filters">{Array.from({length:4},(_,index)=><span className="skeleton-block skeleton-pill" key={index}/>)}</div>}
        <div className={isWorlds?'skeleton-grid skeleton-world-grid':'skeleton-grid'}>{Array.from({length:isWorlds?3:6},(_,index)=><div className="skeleton-card" key={index}><span className="skeleton-block skeleton-card-art"/><span className="skeleton-block skeleton-card-label"/><span className="skeleton-block skeleton-card-name"/><span className="skeleton-block skeleton-card-tags"/></div>)}</div>
      </>}
    </div>
  </div>;
}
