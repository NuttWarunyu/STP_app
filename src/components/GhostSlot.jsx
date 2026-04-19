import { GHOST_CLASSES } from '../constants/ghosts'
import { DangerDots } from './FeedCard'

export default function GhostSlot({ ghostClass, report, onClick }) {
  const ghost = GHOST_CLASSES[ghostClass]
  const collected = !!report

  return (
    <div
      className={`rounded-card border overflow-hidden cursor-pointer transition-colors ${
        collected
          ? 'bg-white/[0.04] border-gold/[0.15] hover:border-gold/30'
          : 'bg-white/[0.02] border-dim/[0.1] opacity-50'
      }`}
      onClick={() => collected && onClick?.(report)}
    >
      <div className="aspect-square flex items-center justify-center bg-black/20">
        {collected && report.photo_url ? (
          <img
            src={`data:image/jpeg;base64,${report.photo_url}`}
            alt=""
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <span className={`text-2xl ${collected ? 'opacity-70' : 'opacity-15'}`}>
            {ghost?.icon || '?'}
          </span>
        )}
      </div>

      <div className="border-t border-dim/[0.1] p-2 space-y-1">
        {collected ? (
          <>
            <p className="font-sans text-[15px] text-parchment/75 truncate leading-tight">
              {ghost?.nameTh || ghostClass}
            </p>
            <DangerDots level={ghost?.dangerLevel || 1} />
          </>
        ) : (
          <>
            <p className="font-sans text-[15px] text-dim/30 leading-tight">???</p>
            <p className="font-sans text-[14px] text-dim/20 truncate">{ghostClass}</p>
          </>
        )}
      </div>
    </div>
  )
}
