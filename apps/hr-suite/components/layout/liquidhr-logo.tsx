import Image from 'next/image'

type LogoVariant = 'horizontal' | 'wordmark' | 'mark'
type LogoSize = 'xs' | 'sm' | 'md' | 'lg'

interface LiquidHRLogoProps {
  alt?: string
  decorative?: boolean
  size?: LogoSize
  variant?: LogoVariant
}

const logoAssets: Record<LogoVariant, { height: number; src: string; width: number }> = {
  horizontal: {
    src: '/brand/logo/branding/transparent/logo-horizontal-transparent.png',
    width: 2039,
    height: 678,
  },
  wordmark: {
    src: '/brand/logo/branding/transparent/wordmark-transparent.png',
    width: 2030,
    height: 665,
  },
  mark: {
    src: '/brand/logo/branding/transparent/mark-transparent.png',
    width: 1254,
    height: 1189,
  },
}

const sizeClasses: Record<LogoVariant, Record<LogoSize, string>> = {
  horizontal: { xs: 'w-20', sm: 'w-28', md: 'w-36', lg: 'w-52' },
  wordmark: { xs: 'w-16', sm: 'w-20', md: 'w-32', lg: 'w-44' },
  mark: { xs: 'size-7', sm: 'size-10', md: 'size-12', lg: 'size-14' },
}

const imageSizes: Record<LogoVariant, Record<LogoSize, string>> = {
  horizontal: { xs: '72px', sm: '104px', md: '136px', lg: '200px' },
  wordmark: { xs: '56px', sm: '72px', md: '120px', lg: '168px' },
  mark: { xs: '20px', sm: '32px', md: '40px', lg: '48px' },
}

export function LiquidHRLogo({
  alt = 'LiquidHR',
  decorative = false,
  size = 'md',
  variant = 'horizontal',
}: LiquidHRLogoProps) {
  const asset = logoAssets[variant]
  const imageClassName = variant === 'mark' ? 'size-full object-contain' : 'h-auto w-full'

  return (
    <span
      aria-hidden={decorative || undefined}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-border-subtle bg-white p-1 ${sizeClasses[variant][size]}`}
    >
      <Image
        alt={decorative ? '' : alt}
        loading="eager"
        className={imageClassName}
        height={asset.height}
        sizes={imageSizes[variant][size]}
        src={asset.src}
        width={asset.width}
      />
    </span>
  )
}
