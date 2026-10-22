'use client';

import { ArrowUpRight, Play, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getYouTubeEmbedUrl, type PublicPromoVideo } from '@/lib/public-site';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';

function orderedVideos(videos: PublicPromoVideo[]) {
  return videos
    .filter((video) => video.active && Boolean(getYouTubeEmbedUrl(video.youtubeUrl)))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'fr'));
}

export function PublicPromoVideosSection() {
  const [videos, setVideos] = useState<PublicPromoVideo[]>([]);

  useEffect(() => {
    const load = () => setVideos(readLocal<PublicPromoVideo[]>(FARM_STORAGE_KEYS.publicPromoVideos, []));
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.publicPromoVideos], load);
  }, []);

  const publishedVideos = orderedVideos(videos);

  return (
    <section id="videos-publicitaires" className="landing-reveal border-t border-[#e7ece5] bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1260px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="landing-section-kicker">Communication de la société</p>
            <h2 className="landing-section-title mt-4">Découvrez SCOOPS LE REVEIL <em>en images.</em></h2>
          </div>
          <p className="max-w-[380px] text-[13px] leading-6 text-[#849188]">Retrouvez nos films promotionnels, nos activités et les histoires qui font vivre la coopérative.</p>
        </div>

        {publishedVideos.length ? (
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {publishedVideos.map((video, index) => {
              const embedUrl = getYouTubeEmbedUrl(video.youtubeUrl);
              return (
                <article key={video.id} className={`overflow-hidden rounded-[26px] border border-[#e2ebe0] bg-[#f7faf5] shadow-[0_14px_32px_rgba(25,56,46,.06)] ${index === 0 ? 'lg:col-span-2 lg:grid lg:grid-cols-[1.15fr_.85fr]' : ''}`}>
                  <div className="relative aspect-video min-h-[230px] overflow-hidden bg-[#19382e] lg:min-h-0">
                    <iframe
                      title={video.title}
                      src={embedUrl}
                      className="absolute inset-0 h-full w-full border-0"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                    <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#19382e]/85 px-3 py-1.5 text-[10px] font-bold text-white"><Play size={11} fill="currentColor" /> Vidéo {String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="flex flex-col justify-center p-6 sm:p-8">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#e7f6e4] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#579a58]"><Video size={12} /> Film promotionnel</span>
                    <h3 className="mt-5 text-[22px] font-bold leading-tight tracking-[-.05em] text-forest sm:text-[27px]">{video.title}</h3>
                    {video.description && <p className="mt-4 text-[13px] leading-6 text-[#6d7e74]">{video.description}</p>}
                    <a href={video.youtubeUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex w-fit items-center gap-2 text-[11px] font-bold text-[#5b9d5b] transition hover:text-forest">Voir la vidéo sur YouTube <ArrowUpRight size={14} /></a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_.85fr] lg:items-stretch">
            <div className="flex min-h-[260px] items-center justify-center rounded-[26px] bg-[#19382e] px-6 py-12 text-center text-white shadow-[0_18px_36px_rgba(25,56,46,.1)]">
              <div className="max-w-sm">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#a4eb91] text-forest"><Video size={22} /></span>
                <h3 className="mt-5 text-[24px] font-bold tracking-[-.05em]">Nos vidéos arrivent bientôt.</h3>
                <p className="mt-3 text-[12px] leading-6 text-[#b5cdbb]">Les films promotionnels de SCOOPS LE REVEIL seront publiés ici prochainement.</p>
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-[26px] border border-[#e2ebe0] bg-[#f7faf5] p-7 sm:p-9">
              <p className="landing-section-kicker">Un regard sur notre travail</p>
              <h3 className="mt-3 text-[25px] font-bold leading-tight tracking-[-.05em] text-forest">Produire, transformer, valoriser.</h3>
              <p className="mt-4 text-[13px] leading-6 text-[#6d7e74]">Cette galerie vidéo présentera les activités, les équipes et les savoir-faire de la coopérative.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
