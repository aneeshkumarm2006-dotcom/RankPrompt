import type { Brand } from '@pv/shared';
import { useOutletContext } from 'react-router';

/** The brand loaded by `BrandLayout`, for pages under `/app/brands/:brandId/*`. */
export function useBrandOutlet(): Brand {
  return useOutletContext<{ brand: Brand }>().brand;
}
