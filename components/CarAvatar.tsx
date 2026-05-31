import Image from "next/image";

export default function CarAvatar({ src, alt, size = 10 }: { src?: string | null; alt: string; size?: number }) {
  const px = size * 4; // tailwind padding approximation
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full overflow-hidden ring-1 ring-white/10 shadow-sm bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center`}
      >
        {src ? (
          // Use next/image when possible
          // fallback to img if not available
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : (
          <div className="text-white font-semibold">{alt.split(" ").map(s=>s[0]).slice(0,2).join("")}</div>
        )}
      </div>
    </div>
  );
}
