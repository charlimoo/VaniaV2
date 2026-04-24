export interface LocationOptionLike {
  id: number;
  name: string;
}

export interface ParsedLocationName {
  city: string | null;
  isProvince: boolean;
  label: string;
  province: string;
  searchValue: string;
}

interface PaginatedLocationResponse<T> {
  next?: string | null;
  results?: T[];
}

export function parseLocationName(name: string): ParsedLocationName {
  const trimmed = name.trim();
  const parts = trimmed.split(" - ").map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const province = parts[0];
    const city = parts.slice(1).join(" - ");
    const label = `${city}، ${province}`;
    return {
      city,
      isProvince: false,
      label,
      province,
      searchValue: [trimmed, label, city, province].join(" "),
    };
  }

  return {
    city: null,
    isProvince: true,
    label: trimmed,
    province: trimmed,
    searchValue: trimmed,
  };
}

export function sortLocationsForPicker<T extends LocationOptionLike>(locations: T[]): T[] {
  return [...locations].sort((a, b) => {
    const left = parseLocationName(a.name);
    const right = parseLocationName(b.name);

    if (left.isProvince !== right.isProvince) {
      return left.isProvince ? -1 : 1;
    }

    const provinceCompare = left.province.localeCompare(right.province, "fa");
    if (provinceCompare !== 0) return provinceCompare;

    return left.label.localeCompare(right.label, "fa");
  });
}

export async function fetchAllLocationOptions<T extends LocationOptionLike>(
  initialUrl: string,
  headers?: HeadersInit
): Promise<T[]> {
  const collected: T[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) {
      throw new Error("Failed to load locations");
    }

    const data = (await response.json()) as T[] | PaginatedLocationResponse<T>;

    if (Array.isArray(data)) {
      collected.push(...data);
      break;
    }

    collected.push(...(data.results || []));
    nextUrl = data.next || null;
  }

  return collected;
}
